from qdrant_client import QdrantClient
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class VectorStoreService:
    def __init__(self):
        self.client = None
        try:
            self.client = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY or None,
                timeout=5
            )
            logger.info("Qdrant client initialized successfully.")
        except Exception as e:
            logger.warning(f"Failed to initialize Qdrant client: {e}. Semantic memory will be unavailable.")

    def search_similar(self, collection_name: str, query_vector: list, limit: int = 5):
        if not self.client:
            logger.warning("Qdrant client not available.")
            return []
        try:
            return self.client.search(
                collection_name=collection_name,
                query_vector=query_vector,
                limit=limit
            )
        except Exception as e:
            logger.error(f"Failed to search Qdrant: {e}")
            return []

vector_store = VectorStoreService()
