from neo4j import GraphDatabase
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class GraphStoreService:
    def __init__(self):
        self.driver = None
        try:
            self.driver = GraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD)
            )
            # Verify driver connection
            self.driver.verify_connectivity()
            logger.info("Neo4j connection established successfully.")
        except Exception as e:
            logger.warning(f"Failed to initialize Neo4j connection: {e}. Graph features will be unavailable.")

    def run_query(self, query: str, parameters: dict = None):
        if not self.driver:
            logger.warning("Neo4j connection is unavailable.")
            return []
        try:
            with self.driver.session() as session:
                result = session.run(query, parameters or {})
                return [record.data() for record in result]
        except Exception as e:
            logger.error(f"Neo4j query execution failed: {e}")
            return []

    def close(self):
        if self.driver:
            self.driver.close()

graph_store = GraphStoreService()
