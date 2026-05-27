from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from fastapi.responses import Response, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from uuid import UUID
import os, uuid, aiofiles, math

from app.db.session import get_db
from app.core.deps import get_estudiante, get_coordinador, get_admin_academico, get_admin_sistema, get_staff, get_current_active_verified_user
from app.schemas.tramites import (
    ReincorporacionCreate, ReincorporacionResponse, ReincorporacionListResponse,
    DictamenReincorporacion, ResolucionReincorporacion,
    PagoCreate, PagoResponse,
)
from app.schemas.licencia import AnularTramite
from app.services import reincorporacion_service, pago_service
from app.services.resolucion_service import generar_resolucion_reincorporacion_pdf
from app.models.user import User, UserRole
from app.models.documento import Documento, TipoDocumento
from app.models.reincorporacion import Reincorporacion
from app.models.licencia import TramiteStatus
from app.models.pago import Pago
from app.core.config import settings

router_rei = APIRouter(prefix="/reincorporaciones", tags=["Reincorporaciones"])
router_pago = APIRouter(prefix="/pagos", tags=["Pagos"])


def _paginate(q, page, page_size, schema):
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [schema.model_validate(i).model_dump(mode="json") for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
    }


# ═══════════════════════ REINCORPORACIONES ════════════════════════════════════

@router_rei.post("", response_model=ReincorporacionResponse, status_code=201)
def crear(data: ReincorporacionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_estudiante)):
    return reincorporacion_service.crear_reincorporacion(db, data, current_user)


@router_rei.get("/mis-reincorporaciones")
def mis_reincorporaciones(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None),
    fecha_inicio: Optional[str] = Query(None),
    fecha_fin: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_estudiante),
):
    q = db.query(Reincorporacion).filter(Reincorporacion.estudiante_id == current_user.id)
    if status:
        q = q.filter(Reincorporacion.status == status)
    if fecha_inicio:
        q = q.filter(Reincorporacion.created_at >= fecha_inicio)
    if fecha_fin:
        q = q.filter(Reincorporacion.created_at <= fecha_fin)
    if search:
        q = q.filter(or_(
            Reincorporacion.codigo.ilike(f"%{search}%"),
            Reincorporacion.numero_rd.ilike(f"%{search}%"),
        ))
    return _paginate(q.order_by(Reincorporacion.created_at.desc()), page, page_size, ReincorporacionListResponse)


@router_rei.post("/{rei_id}/documentos", status_code=201)
async def subir_documento(
    rei_id: UUID,
    tipo: TipoDocumento,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_verified_user),
):
    rei = reincorporacion_service.get_reincorporacion(db, rei_id, current_user)
    if file.content_type not in settings.ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido")

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"El archivo supera {settings.MAX_FILE_SIZE_MB}MB")

    file_uuid = str(uuid.uuid4())
    extension = file.filename.split(".")[-1]
    nombre_guardado = f"{file_uuid}.{extension}"
    ruta = os.path.join(settings.UPLOAD_DIR, nombre_guardado)

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    async with aiofiles.open(ruta, "wb") as f:
        await f.write(content)

    doc = Documento(
        reincorporacion_id=rei_id,
        subido_por_id=current_user.id,
        nombre_original=file.filename,
        nombre_guardado=nombre_guardado,
        ruta=ruta,
        tipo_documento=tipo,
        mime_type=file.content_type,
        tamano_bytes=len(content),
    )
    db.add(doc)
    if rei.status == TramiteStatus.RECHAZADO_COORDINADOR:
        rei.status = TramiteStatus.PENDIENTE_REVISION
    db.commit()
    return {"message": "Documento subido", "id": str(doc.id)}


@router_rei.get("/{rei_id}", response_model=ReincorporacionResponse)
def get_rei(rei_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_verified_user)):
    return reincorporacion_service.get_reincorporacion(db, rei_id, current_user)


@router_rei.get("/{rei_id}/documentos/{documento_id}/descargar")
def descargar_documento(rei_id: UUID, documento_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_verified_user)):
    reincorporacion_service.get_reincorporacion(db, rei_id, current_user)
    doc = db.query(Documento).filter(Documento.id == documento_id, Documento.reincorporacion_id == rei_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if not os.path.exists(doc.ruta):
        raise HTTPException(status_code=404, detail="Archivo no encontrado en el servidor")
    return FileResponse(path=doc.ruta, media_type=doc.mime_type, filename=doc.nombre_original)


@router_rei.get("/bandeja/coordinador")
def bandeja_coordinador(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None),
    fecha_inicio: Optional[str] = Query(None),
    fecha_fin: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_coordinador),
):
    q = (
        db.query(Reincorporacion)
        .join(User, User.id == Reincorporacion.estudiante_id)
        .filter(
            Reincorporacion.status.in_([
                TramiteStatus.PENDIENTE_REVISION, TramiteStatus.EN_REVISION,
                TramiteStatus.RECHAZADO_COORDINADOR, TramiteStatus.APROBADO, TramiteStatus.RECHAZADO,
            ]),
            User.carrera == current_user.carrera_asignada,
        )
    )
    if status:
        q = q.filter(Reincorporacion.status == status)
    if fecha_inicio:
        q = q.filter(Reincorporacion.created_at >= fecha_inicio)
    if fecha_fin:
        q = q.filter(Reincorporacion.created_at <= fecha_fin)
    if search:
        q = q.filter(or_(
            Reincorporacion.codigo.ilike(f"%{search}%"),
            User.nombres.ilike(f"%{search}%"),
            User.apellidos.ilike(f"%{search}%"),
        ))
    return _paginate(q.order_by(Reincorporacion.created_at.desc()), page, page_size, ReincorporacionListResponse)


@router_rei.post("/{rei_id}/dictamen", response_model=ReincorporacionResponse)
def dictamen(rei_id: UUID, data: DictamenReincorporacion, db: Session = Depends(get_db), current_user: User = Depends(get_coordinador)):
    return reincorporacion_service.emitir_dictamen_coordinador(db, rei_id, data, current_user)


@router_rei.get("/bandeja/admin-academico")
def bandeja_admin(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None),
    fecha_inicio: Optional[str] = Query(None),
    fecha_fin: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    carrera: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_staff),
):
    q = (
        db.query(Reincorporacion)
        .join(User, User.id == Reincorporacion.estudiante_id)
        .filter(Reincorporacion.status.in_([
            TramiteStatus.EN_REVISION, TramiteStatus.APROBADO, TramiteStatus.RECHAZADO,
        ]))
    )
    if status:
        q = q.filter(Reincorporacion.status == status)
    if fecha_inicio:
        q = q.filter(Reincorporacion.created_at >= fecha_inicio)
    if fecha_fin:
        q = q.filter(Reincorporacion.created_at <= fecha_fin)
    if search:
        q = q.filter(or_(
            Reincorporacion.codigo.ilike(f"%{search}%"),
            User.nombres.ilike(f"%{search}%"),
            User.apellidos.ilike(f"%{search}%"),
        ))
    if carrera:
        q = q.filter(User.carrera.ilike(f"%{carrera}%"))
    return _paginate(q.order_by(Reincorporacion.created_at.desc()), page, page_size, ReincorporacionListResponse)


@router_rei.post("/{rei_id}/resolucion", response_model=ReincorporacionResponse)
def resolucion(rei_id: UUID, data: ResolucionReincorporacion, db: Session = Depends(get_db), current_user: User = Depends(get_admin_academico)):
    return reincorporacion_service.aprobar_reincorporacion(db, rei_id, data, current_user)


@router_rei.delete("/{rei_id}", status_code=204)
def eliminar_reincorporacion(rei_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_estudiante)):
    from app.models.licencia import TramiteStatus
    rei = db.query(Reincorporacion).filter(Reincorporacion.id == rei_id).first()
    if not rei:
        raise HTTPException(status_code=404, detail="Reincorporación no encontrada")
    if rei.estudiante_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso")
    if rei.status != TramiteStatus.BORRADOR:
        raise HTTPException(status_code=400, detail="Solo se pueden eliminar reincorporaciones en borrador")
    db.delete(rei)
    db.commit()


@router_rei.get("")
def listar_todas(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None),
    fecha_inicio: Optional[str] = Query(None),
    fecha_fin: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    carrera: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_sistema),
):
    q = db.query(Reincorporacion).join(User, User.id == Reincorporacion.estudiante_id)
    if status:
        q = q.filter(Reincorporacion.status == status)
    if fecha_inicio:
        q = q.filter(Reincorporacion.created_at >= fecha_inicio)
    if fecha_fin:
        q = q.filter(Reincorporacion.created_at <= fecha_fin)
    if search:
        q = q.filter(or_(
            Reincorporacion.codigo.ilike(f"%{search}%"),
            User.nombres.ilike(f"%{search}%"),
            User.apellidos.ilike(f"%{search}%"),
        ))
    if carrera:
        q = q.filter(User.carrera.ilike(f"%{carrera}%"))
    return _paginate(q.order_by(Reincorporacion.created_at.desc()), page, page_size, ReincorporacionListResponse)


@router_rei.post("/{rei_id}/anular", response_model=ReincorporacionResponse)
def anular(rei_id: UUID, data: AnularTramite, db: Session = Depends(get_db), current_user: User = Depends(get_admin_sistema)):
    return reincorporacion_service.anular_reincorporacion(db, rei_id, data, current_user)


@router_rei.post("/{rei_id}/rehabilitar", response_model=ReincorporacionResponse)
def rehabilitar(rei_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_admin_sistema)):
    return reincorporacion_service.rehabilitar_reincorporacion(db, rei_id, current_user)


# ═══════════════════════ PAGOS ════════════════════════════════════════════════

@router_pago.post("/licencia/{licencia_id}/iniciar", response_model=PagoResponse)
def iniciar_pago_licencia(licencia_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_estudiante)):
    return pago_service.iniciar_pago_licencia(db, licencia_id, current_user)


@router_pago.post("/reincorporacion/{rei_id}/iniciar", response_model=PagoResponse)
def iniciar_pago_rei(rei_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_estudiante)):
    return pago_service.iniciar_pago_reincorporacion(db, rei_id, current_user)


@router_pago.post("/{pago_id}/procesar", response_model=PagoResponse)
def procesar_pago(pago_id: UUID, data: PagoCreate, db: Session = Depends(get_db), current_user: User = Depends(get_estudiante)):
    return pago_service.procesar_pago(db, pago_id, data, current_user)


@router_pago.get("/{pago_id}/comprobante")
def descargar_comprobante(pago_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_estudiante)):
    pago = db.query(Pago).filter(Pago.id == pago_id, Pago.estudiante_id == current_user.id).first()
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    if pago.status.value != "completado":
        raise HTTPException(status_code=400, detail="El pago no está completado")

    pdf_bytes = pago_service.generar_comprobante_pdf(pago, current_user)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=comprobante_{pago.numero_comprobante}.pdf"},
    )


@router_rei.get("/{rei_id}/resolucion-pdf")
def descargar_resolucion_rei(rei_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_verified_user)):
    from app.models.licencia import TramiteStatus
    rei = db.query(Reincorporacion).filter(Reincorporacion.id == rei_id).first()
    if not rei:
        raise HTTPException(status_code=404, detail="Reincorporación no encontrada")
    if rei.status != TramiteStatus.APROBADO:
        raise HTTPException(status_code=400, detail="La reincorporación no está aprobada")
    if current_user.role == UserRole.ESTUDIANTE and rei.estudiante_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso")

    estudiante = db.query(User).filter(User.id == rei.estudiante_id).first()
    admin = db.query(User).filter(User.id == rei.admin_academico_id).first()
    pdf_bytes = generar_resolucion_reincorporacion_pdf(rei, estudiante, admin)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=resolucion_rei_{rei.numero_resolucion}.pdf"},
    )
