from fastapi import APIRouter
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.licencias import router as licencias_router
from app.api.v1.endpoints.tramites import router_rei, router_pago
from app.api.v1.endpoints.otros import router_users, router_notif, router_reports, router_chatbot

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(licencias_router)
api_router.include_router(router_rei)
api_router.include_router(router_pago)
api_router.include_router(router_users)
api_router.include_router(router_notif)
api_router.include_router(router_reports)
api_router.include_router(router_chatbot)
