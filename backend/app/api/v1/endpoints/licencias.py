from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from fastapi.responses import Response, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from uuid import UUID
import os, uuid, aiofiles, math

from app.db.session import get_db
from app.core.deps import get_estudiante, get_coordinador, get_admin_academico, get_admin_sistema, get_staff, get_current_active_verified_user
from app.schemas.licencia import LicenciaCreate, LicenciaResponse, LicenciaListResponse, DictamenCoordinador, ResolucionAdmin, AnularTramite
from app.services import licencia_service
from app.services.resolucion_service import generar_resolucion_licencia_pdf
from app.models.user import User, UserRole
from app.models.documento import Documento, TipoDocumento
from app.models.licencia import Licencia, TramiteStatus
from app.core.config import settings

router = APIRouter(prefix="/licencias", tags=["Licencias"])


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


# ── Estudiante ────────────────────────────────────────────────────────────────

@router.post("", response_model=LicenciaResponse, status_code=201)
def crear_licencia(data: LicenciaCreate, db: Session = Depends(get_db), current_user: User = Depends(get_estudiante)):
    return licencia_service.crear_licencia(db, data, current_user)


@router.get("/mis-licencias")
def mis_licencias(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None),
    fecha_inicio: Optional[str] = Query(None),
    fecha_fin: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_estudiante),
):
    q = db.query(Licencia).filter(Licencia.estudiante_id == current_user.id)
    if status:
        q = q.filter(Licencia.status == status)
    if fecha_inicio:
        q = q.filter(Licencia.fecha_inicio >= fecha_inicio)
    if fecha_fin:
        q = q.filter(Licencia.fecha_fin <= fecha_fin)
    if search:
        q = q.filter(Licencia.codigo.ilike(f"%{search}%"))
    return _paginate(q.order_by(Licencia.created_at.desc()), page, page_size, LicenciaListResponse)


@router.post("/{licencia_id}/documentos", status_code=201)
async def subir_documento(
    licencia_id: UUID,
    tipo: TipoDocumento,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_verified_user),
):
    lic = licencia_service.get_licencia(db, licencia_id, current_user)
    if not file.content_type in settings.ALLOWED_MIME_TYPES:
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
        licencia_id=licencia_id,
        subido_por_id=current_user.id,
        nombre_original=file.filename,
        nombre_guardado=nombre_guardado,
        ruta=ruta,
        tipo_documento=tipo,
        mime_type=file.content_type,
        tamano_bytes=len(content),
    )
    db.add(doc)
    if lic.status == TramiteStatus.RECHAZADO_COORDINADOR:
        lic.status = TramiteStatus.PENDIENTE_REVISION
    db.commit()
    return {"message": "Documento subido exitosamente", "id": str(doc.id)}


# ── Vista detalle (todos los roles autorizados) ───────────────────────────────

@router.get("/{licencia_id}", response_model=LicenciaResponse)
def get_licencia(licencia_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_verified_user)):
    return licencia_service.get_licencia(db, licencia_id, current_user)


@router.get("/{licencia_id}/documentos/{documento_id}/descargar")
def descargar_documento(licencia_id: UUID, documento_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_verified_user)):
    licencia_service.get_licencia(db, licencia_id, current_user)
    doc = db.query(Documento).filter(Documento.id == documento_id, Documento.licencia_id == licencia_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if not os.path.exists(doc.ruta):
        raise HTTPException(status_code=404, detail="Archivo no encontrado en el servidor")
    return FileResponse(path=doc.ruta, media_type=doc.mime_type, filename=doc.nombre_original)


# ── Coordinador ───────────────────────────────────────────────────────────────

@router.get("/bandeja/coordinador")
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
        db.query(Licencia)
        .join(User, User.id == Licencia.estudiante_id)
        .filter(
            Licencia.status.in_([
                TramiteStatus.PENDIENTE_REVISION, TramiteStatus.EN_REVISION,
                TramiteStatus.RECHAZADO_COORDINADOR, TramiteStatus.APROBADO, TramiteStatus.RECHAZADO,
            ]),
            User.carrera == current_user.carrera_asignada,
        )
    )
    if status:
        q = q.filter(Licencia.status == status)
    if fecha_inicio:
        q = q.filter(Licencia.fecha_inicio >= fecha_inicio)
    if fecha_fin:
        q = q.filter(Licencia.fecha_fin <= fecha_fin)
    if search:
        q = q.filter(or_(
            Licencia.codigo.ilike(f"%{search}%"),
            User.nombres.ilike(f"%{search}%"),
            User.apellidos.ilike(f"%{search}%"),
        ))
    return _paginate(q.order_by(Licencia.created_at.desc()), page, page_size, LicenciaListResponse)


@router.post("/{licencia_id}/dictamen", response_model=LicenciaResponse)
def emitir_dictamen(licencia_id: UUID, data: DictamenCoordinador, db: Session = Depends(get_db), current_user: User = Depends(get_coordinador)):
    return licencia_service.emitir_dictamen_coordinador(db, licencia_id, data, current_user)


# ── Admin académico ───────────────────────────────────────────────────────────

@router.get("/bandeja/admin-academico")
def bandeja_admin_academico(
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
        db.query(Licencia)
        .join(User, User.id == Licencia.estudiante_id)
        .filter(Licencia.status.in_([
            TramiteStatus.EN_REVISION, TramiteStatus.APROBADO, TramiteStatus.RECHAZADO,
        ]))
    )
    if status:
        q = q.filter(Licencia.status == status)
    if fecha_inicio:
        q = q.filter(Licencia.fecha_inicio >= fecha_inicio)
    if fecha_fin:
        q = q.filter(Licencia.fecha_fin <= fecha_fin)
    if search:
        q = q.filter(or_(
            Licencia.codigo.ilike(f"%{search}%"),
            User.nombres.ilike(f"%{search}%"),
            User.apellidos.ilike(f"%{search}%"),
        ))
    if carrera:
        q = q.filter(User.carrera.ilike(f"%{carrera}%"))
    return _paginate(q.order_by(Licencia.created_at.desc()), page, page_size, LicenciaListResponse)


@router.post("/{licencia_id}/resolucion", response_model=LicenciaResponse)
def emitir_resolucion(licencia_id: UUID, data: ResolucionAdmin, db: Session = Depends(get_db), current_user: User = Depends(get_admin_academico)):
    return licencia_service.emitir_resolucion_admin(db, licencia_id, data, current_user)


# ── Estudiante — eliminar borrador ───────────────────────────────────────────

@router.delete("/{licencia_id}", status_code=204)
def eliminar_licencia(licencia_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_estudiante)):
    lic = db.query(Licencia).filter(Licencia.id == licencia_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Licencia no encontrada")
    if lic.estudiante_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso")
    if lic.status != TramiteStatus.BORRADOR:
        raise HTTPException(status_code=400, detail="Solo se pueden eliminar licencias en borrador")
    db.delete(lic)
    db.commit()


# ── Admin sistema ─────────────────────────────────────────────────────────────

@router.get("")
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
    q = db.query(Licencia).join(User, User.id == Licencia.estudiante_id)
    if status:
        q = q.filter(Licencia.status == status)
    if fecha_inicio:
        q = q.filter(Licencia.fecha_inicio >= fecha_inicio)
    if fecha_fin:
        q = q.filter(Licencia.fecha_fin <= fecha_fin)
    if search:
        q = q.filter(or_(
            Licencia.codigo.ilike(f"%{search}%"),
            User.nombres.ilike(f"%{search}%"),
            User.apellidos.ilike(f"%{search}%"),
        ))
    if carrera:
        q = q.filter(User.carrera.ilike(f"%{carrera}%"))
    return _paginate(q.order_by(Licencia.created_at.desc()), page, page_size, LicenciaListResponse)


@router.post("/{licencia_id}/anular", response_model=LicenciaResponse)
def anular(licencia_id: UUID, data: AnularTramite, db: Session = Depends(get_db), current_user: User = Depends(get_admin_sistema)):
    return licencia_service.anular_licencia(db, licencia_id, data, current_user)


@router.post("/{licencia_id}/rehabilitar", response_model=LicenciaResponse)
def rehabilitar(licencia_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_admin_sistema)):
    return licencia_service.rehabilitar_licencia(db, licencia_id, current_user)


@router.get("/{licencia_id}/resolucion-pdf")
def descargar_resolucion(licencia_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_verified_user)):
    lic = db.query(Licencia).filter(Licencia.id == licencia_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Licencia no encontrada")
    if lic.status != TramiteStatus.APROBADO:
        raise HTTPException(status_code=400, detail="La licencia no está aprobada")
    if current_user.role == UserRole.ESTUDIANTE and lic.estudiante_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso")

    estudiante = db.query(User).filter(User.id == lic.estudiante_id).first()
    admin = db.query(User).filter(User.id == lic.admin_academico_id).first()
    pdf_bytes = generar_resolucion_licencia_pdf(lic, estudiante, admin)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=resolucion_{lic.numero_resolucion}.pdf"},
    )
