import os


TRUE_VALUES = {"1", "true", "yes", "on"}


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in TRUE_VALUES


def env_list(name, default=()):
    value = os.getenv(name)
    if value is None:
        return list(default)
    return [item.strip() for item in value.split(",") if item.strip()]
