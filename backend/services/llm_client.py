"""OpenAI-compatible LLM client singleton (DeepSeek via OpenAI SDK)."""

from openai import OpenAI

from backend.config import settings

_client: OpenAI | None = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
        )
    return _client
