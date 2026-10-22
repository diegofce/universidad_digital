"""Controlled application exceptions and HTTP mapping."""

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Expected application error with a safe client-facing message."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        self.message = message
        self.status_code = status_code


def register_error_handlers(app: FastAPI) -> None:
    """Register centralized handling for expected application failures."""

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code, content={"detail": exc.message}
        )

    @app.exception_handler(HTTPException)
    async def handle_http_error(request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422, content={"detail": jsonable_encoder(exc.errors())}
        )

    @app.exception_handler(SQLAlchemyError)
    async def handle_database_error(
        request: Request, exc: SQLAlchemyError
    ) -> JSONResponse:
        logger.exception("Unhandled database error", exc_info=exc)
        return JSONResponse(
            status_code=500, content={"detail": "Database operation failed"}
        )
