# cogitatio-virtualis/cogitatio-server/cogitatio/api/types.py

from typing import List, Optional
from pydantic import BaseModel, Field
from cogitatio.types.schemas import DocumentType

class SearchRequest(BaseModel):
    query_text: str
    k: int = Field(default=5, ge=1, le=20)
    filter_types: Optional[List[DocumentType]] = None
    use_hyde: bool = False