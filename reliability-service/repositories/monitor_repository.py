import logging
import os
from datetime import datetime, timezone

import grpc
from proto import user_pb2, user_pb2_grpc

from models.monitor import MonitorCheck

logger = logging.getLogger(__name__)

DEFAULT_GRPC_ADDRESS = "localhost:8080"
DEFAULT_CHECK_LIMIT = 50


def get_recent_checks(monitor_id: str) -> list[MonitorCheck]:
    address = os.getenv("UPSTAT_GRPC_ADDRESS", DEFAULT_GRPC_ADDRESS)
    token = os.getenv("UPSTAT_GRPC_AUTH_TOKEN")
    limit = int(os.getenv("UPSTAT_GRPC_CHECK_LIMIT", DEFAULT_CHECK_LIMIT))

    try:
        logger.info(f"Connecting to gRPC server at {address}")
        with grpc.insecure_channel(address) as channel:
            logger.info(f"Connected to gRPC server at {address}")
            stub = user_pb2_grpc.MonitorServiceStub(channel)
            request = user_pb2.GetRecentChecksRequest(
                monitor_id=monitor_id,
                limit=limit,
            )
            logger.debug(f"Requesting recent checks for monitor {monitor_id} with limit {limit}")
            response = stub.GetRecentChecks(
                request,
                timeout=5,
                metadata=_auth_metadata(token),
            )
            logger.info(f"Successfully retrieved {len(response.checks)} checks for monitor {monitor_id}")

        return [convert_proto_check(check) for check in response.checks]
    except Exception as e:
        logger.error(f"Failed to get recent checks from gRPC server: {type(e).__name__} - {str(e)}")
        raise


def get_monitor_name(monitor_id: str) -> str | None:
    address = os.getenv("UPSTAT_GRPC_ADDRESS", DEFAULT_GRPC_ADDRESS)
    token = os.getenv("UPSTAT_GRPC_AUTH_TOKEN")

    try:
        with grpc.insecure_channel(address) as channel:
            stub = user_pb2_grpc.MonitorServiceStub(channel)
            request = user_pb2.GetMonitorRequest(id=monitor_id)
            response = stub.GetMonitor(request, timeout=5, metadata=_auth_metadata(token))
            return response.monitor.name if response.monitor is not None else None
    except Exception as e:
        logger.error(f"Failed to get monitor name from gRPC server: {type(e).__name__} - {str(e)}")
        return None



def convert_proto_check(check: user_pb2.MonitorCheck) -> MonitorCheck:
    return MonitorCheck(
        monitor_id=check.monitor_id,
        success=check.success,
        response_time_ms=check.response_time,
        status_code=check.status_code,
        checked_at=_parse_checked_at(check.checked_at),
    )


def _auth_metadata(token: str | None) -> tuple[tuple[str, str], ...]:
    if not token:
        return ()
    return (("authorization", f"Bearer {token}"),)


def _parse_checked_at(value: str) -> datetime:
    if not value:
        return datetime.now(timezone.utc)

    return datetime.fromisoformat(value.replace("Z", "+00:00"))
