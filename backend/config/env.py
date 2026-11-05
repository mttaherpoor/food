import os
from pathlib import Path


class ImproperSecretConfiguration(RuntimeError):
    """Raised when a required file-based secret cannot be loaded."""


def get_bool(name: str, *, default: bool = False) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def get_csv(name: str, *, default: str = "") -> list[str]:
    raw_value = os.getenv(name, default)
    return [value.strip() for value in raw_value.split(",") if value.strip()]


def get_secret(name: str, *, default_file: Path | None = None) -> str:
    file_variable = f"{name}_FILE"
    configured_path = os.getenv(file_variable)
    secret_path = Path(configured_path) if configured_path else default_file

    if secret_path is None:
        raise ImproperSecretConfiguration(
            f"{file_variable} must point to a readable, non-empty secret file."
        )

    try:
        value = secret_path.read_text(encoding="utf-8").strip()
    except OSError as exc:
        raise ImproperSecretConfiguration(
            f"Unable to read secret file configured by {file_variable}: {secret_path}"
        ) from exc

    if not value:
        raise ImproperSecretConfiguration(
            f"Secret file configured by {file_variable} is empty: {secret_path}"
        )
    return value
