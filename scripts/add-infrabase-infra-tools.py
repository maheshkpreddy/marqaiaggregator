#!/usr/bin/env python3
"""
Append missing infrastructure tools from infrabase.ai:
  - Vector databases
  - Observability / analytics
  - Fine-tuning platforms
  - Prompt engineering tools

Idempotent: skips any entry whose `name` key already exists in the file.
"""
from pathlib import Path
import re
import sys

FILE = Path("/home/z/my-project/src/lib/provider-benefits.ts")

ENTRIES = [
    # ─── VECTOR DATABASES ─────────────────────────────────────────────────
    {
        "name": "pinecone",
        "displayName": "Pinecone",
        "tagline": "Managed vector database built for production RAG — serverless scale, sub-50ms queries at 1B+ vectors.",
        "icon": "Database",
        "color": "#000000",
        "category": "specialized",
        "kind": "service",
        "popularity": "very-high",
        "bestFor": [
            "Production RAG without infra ops",
            "Serverless scaling to billions of vectors",
            "Hybrid search (vector + keyword) in one query",
            "Multi-tenant SaaS with namespace isolation",
        ],
        "capabilities": [
            "Serverless vector DB — pay per query, no clusters",
            "Hybrid search: dense + sparse vectors in one query",
            "Namespaces for multi-tenant isolation",
            "Metadata filtering on vector queries",
            "Integrated embeddings (Inference API)",
        ],
        "whenToUse": [
            "Production RAG without managing infra",
            "Multi-tenant SaaS needing isolation",
        ],
        "limitations": [
            "Vendor lock-in — no self-hosted option",
            "Pricing premium vs self-hosted (Weaviate, Qdrant)",
        ],
        "samplePrompts": [
            "RAG over 10M PDFs with hybrid search + metadata filtering by date.",
            "Multi-tenant product search: each customer in own namespace.",
            "Real-time recommendation engine at 1B+ vectors with sub-50ms queries.",
        ],
        "setupNotes": "Sign up at pinecone.io, create an index. pip install pinecone. Set PINECONE_API_KEY. Initialize Index with dimension matching your embeddings.",
        "pricingTier": "Free: 100k vectors / 2GB. Standard: $0.10 / 1k query units + storage. Enterprise: contact sales.",
        "docsUrl": "https://docs.pinecone.io",
        "availableModels": ["(any embedding model — Pinecone stores vectors)"],
        "availableAgents": ["rag-researcher", "recommender", "semantic-search"],
        "advantages": [
            "Serverless — no clusters to manage",
            "Hybrid search in one query",
            "Multi-tenant namespaces out of the box",
            "Integrated embeddings via Inference API",
        ],
        "businessAdvantages": [
            "Fastest time-to-production for RAG",
            "Serverless pricing = no idle costs",
        ],
        "apiIntegrationDetails": "Python: from pinecone import Pinecone; pc = Pinecone(api_key=...); idx = pc.Index('name'); idx.upsert(vectors); idx.query(vector, top_k, filter).",
        "modalities": ["embeddings"],
    },
    {
        "name": "weaviate",
        "displayName": "Weaviate",
        "tagline": "Open-source vector database with hybrid search, modular ML, and GraphQL API — self-host or managed.",
        "icon": "Database",
        "color": "#0f766e",
        "category": "specialized",
        "kind": "framework",
        "popularity": "very-high",
        "bestFor": [
            "Self-hosted vector DB with hybrid search",
            "Modular ML integrations (OpenAI, Cohere, HuggingFace)",
            "GraphQL API for flexible queries",
            "Multi-modal: text + image + PDF in one DB",
        ],
        "capabilities": [
            "Hybrid search: BM25 + vector in one query",
            "Modular vectorizers: OpenAI, Cohere, HuggingFace, Sentence-Transformers",
            "Multi-modal: store text + image + PDF",
            "GraphQL API for complex queries",
            "Generative search: retrieve + LLM-summarize in one call",
        ],
        "whenToUse": [
            "Need hybrid search (keyword + vector)",
            "Want modular ML without writing integration code",
        ],
        "limitations": [
            "Self-hosted requires maintenance",
            "Schema setup is more complex than Pinecone",
        ],
        "samplePrompts": [
            "RAG with hybrid search: BM25 keyword + vector for legal document retrieval.",
            "Multi-modal: search by image (find similar product photos).",
            "Generative search: retrieve top-10 + Claude summarizes.",
        ],
        "setupNotes": "Self-host: docker run -p 8080:8080 semitechnologies/weaviate. Or use Weaviate Cloud at console.weaviate.cloud. Python: pip install weaviate-client.",
        "pricingTier": "Open-source free. Weaviate Cloud: from $25/mo (serverless) or $0.40/hour (dedicated).",
        "docsUrl": "https://weaviate.io/developers/weaviate",
        "availableModels": ["(modular: OpenAI, Cohere, HuggingFace, Sentence-Transformers)"],
        "availableAgents": ["rag-researcher", "image-search", "multimodal-search"],
        "advantages": [
            "Hybrid search (BM25 + vector) in one query",
            "Modular vectorizers — plug in any embedding model",
            "Multi-modal: text + image + PDF in one DB",
            "Open-source — self-host for free",
        ],
        "businessAdvantages": [
            "Hybrid search improves RAG precision",
            "Self-host option for data residency",
        ],
        "apiIntegrationDetails": "Python: import weaviate; client = weaviate.connect_to_local(); client.collections.create('name', ...); coll.query.near_text(query, limit).",
        "modalities": ["embeddings", "vision"],
    },
    {
        "name": "milvus",
        "displayName": "Milvus",
        "tagline": "Open-source vector database built for 10B+ scale — cloud-native, Kubernetes-ready.",
        "icon": "Database",
        "color": "#0ea5e9",
        "category": "specialized",
        "kind": "framework",
        "popularity": "very-high",
        "bestFor": [
            "Massive-scale vector search (10B+ vectors)",
            "Self-hosted on Kubernetes",
            "Multi-index: HNSW, IVF, DiskANN, GPU",
            "Cost-optimized at scale (Zilliz Cloud)",
        ],
        "capabilities": [
            "10B+ vector scale with sharding",
            "Multi-index: HNSW, IVF_FLAT, IVF_SQ8, DiskANN, GPU-enabled",
            "Hybrid search: vector + scalar filtering",
            "Multi-vector: dense + sparse in one collection",
            "Cloud-native on Kubernetes",
        ],
        "whenToUse": [
            "Need 1B+ vector scale",
            "Kubernetes-native deployment",
        ],
        "limitations": [
            "Complex setup vs Pinecone / Qdrant",
            "Requires Kubernetes expertise for production",
        ],
        "samplePrompts": [
            "10B-scale image search: find similar photos across 10B image embeddings.",
            "Real-time recommendation engine at 1B+ users.",
            "Multi-vector RAG: dense + sparse retrieval with reranking.",
        ],
        "setupNotes": "Self-host: helm install milvus milvus/milvus on K8s. Or use Zilliz Cloud at zilliz.com. Python: pip install pymilvus.",
        "pricingTier": "Open-source free. Zilliz Cloud: from $0.10 / 1k query units.",
        "docsUrl": "https://milvus.io/docs",
        "availableModels": ["(any embedding model — Milvus stores vectors)"],
        "availableAgents": ["rag-researcher", "recommender", "image-search"],
        "advantages": [
            "10B+ vector scale — class-leading",
            "Multiple index types for different scale/cost tradeoffs",
            "Cloud-native Kubernetes deployment",
            "Open-source — no vendor lock-in",
        ],
        "businessAdvantages": [
            "Massive scale at low cost vs Pinecone",
            "Self-host for data sovereignty",
        ],
        "apiIntegrationDetails": "Python: from pymilvus import MilvusClient; client = MilvusClient(uri='http://localhost:19530'); client.create_collection(...); client.insert/search.",
        "modalities": ["embeddings"],
    },
    {
        "name": "qdrant",
        "displayName": "Qdrant",
        "tagline": "Rust-based vector database — fast, memory-efficient, with rich payload filtering.",
        "icon": "Database",
        "color": "#dc2626",
        "category": "specialized",
        "kind": "framework",
        "popularity": "very-high",
        "bestFor": [
            "Memory-efficient vector search (Rust)",
            "Rich payload filtering (nested JSON, geo, range)",
            "Self-hosted single binary or managed cloud",
            "Distributed mode for horizontal scale",
        ],
        "capabilities": [
            "Rust-based — fast + memory-efficient",
            "Rich payload filtering: nested JSON, geo, range, full-text",
            "Quantization: scalar, product, binary — 4-16x compression",
            "Distributed mode with sharding",
            "Hybrid search: dense + sparse",
        ],
        "whenToUse": [
            "Memory is the bottleneck — Qdrant is most efficient",
            "Need complex payload filtering on vectors",
        ],
        "limitations": [
            "Smaller community than Pinecone",
            "Fewer ML integrations than Weaviate",
        ],
        "samplePrompts": [
            "RAG with complex filtering: 'find documents tagged AI after 2024, in English, by author X'.",
            "Image search with 16x compression via product quantization.",
            "Distributed vector search across 5 nodes for 1B+ vectors.",
        ],
        "setupNotes": "Self-host: docker run -p 6333:6333 qdrant/qdrant. Or use Qdrant Cloud at cloud.qdrant.io. Python: pip install qdrant-client.",
        "pricingTier": "Open-source free. Qdrant Cloud: from $25/mo for 1GB. Enterprise: contact sales.",
        "docsUrl": "https://qdrant.tech/documentation",
        "availableModels": ["(any embedding model — Qdrant stores vectors)"],
        "availableAgents": ["rag-researcher", "filtered-search", "geo-search"],
        "advantages": [
            "Rust-based — fast + memory-efficient",
            "Best payload filtering among vector DBs",
            "Multiple quantization options for compression",
            "Single-binary deployment — simplest self-host",
        ],
        "businessAdvantages": [
            "Memory efficiency = lower cloud bills at scale",
            "Complex filtering enables advanced use cases (e-commerce, geo)",
        ],
        "apiIntegrationDetails": "Python: from qdrant_client import QdrantClient; client = QdrantClient(url='http://localhost:6333'); client.upsert(collection_name, points); client.search(collection_name, query_vector).",
        "modalities": ["embeddings"],
    },
    {
        "name": "chroma",
        "displayName": "Chroma",
        "tagline": "Open-source embedding database — Python-native, perfect for AI devs and prototypes.",
        "icon": "Database",
        "color": "#10b981",
        "category": "specialized",
        "kind": "framework",
        "popularity": "very-high",
        "bestFor": [
            "Python-native RAG prototypes",
            "Local development with same API as production",
            "Simplest setup — pip install + 3 lines",
            "Jupyter notebook RAG demos",
        ],
        "capabilities": [
            "Python-native API — feels like a dict",
            "Embedded (local file) or client-server mode",
            "Built-in embeddings (Sentence Transformers) or bring-your-own",
            "Metadata filtering",
            "Chroma Cloud for production",
        ],
        "whenToUse": [
            "Building a prototype / demo — fastest path",
            "Local development with same API as production",
        ],
        "limitations": [
            "Not built for 1B+ scale (use Milvus / Pinecone)",
            "Fewer features than Weaviate / Qdrant",
        ],
        "samplePrompts": [
            "Build a RAG over personal notes in 10 lines of Python with Chroma.",
            "Jupyter notebook: embed 1000 docs, query, render results.",
            "Prototype → production: same Chroma API, swap to Chroma Cloud.",
        ],
        "setupNotes": "pip install chromadb. Python: import chromadb; client = chromadb.PersistentClient(path='./chroma'); col = client.create_collection('docs'); col.add(documents, metadatas, ids).",
        "pricingTier": "Open-source free. Chroma Cloud: contact sales for production pricing.",
        "docsUrl": "https://docs.trychroma.com",
        "availableModels": ["(built-in Sentence Transformers, or any OpenAI/Cohere embedding)"],
        "availableAgents": ["rag-researcher", "notebook-rag", "local-knowledge"],
        "advantages": [
            "Simplest setup — pip install, 3 lines",
            "Python-native API",
            "Same API for local + cloud",
            "Built-in embeddings",
        ],
        "businessAdvantages": [
            "Fastest prototype-to-production for RAG",
            "Developer-friendly = faster onboarding",
        ],
        "apiIntegrationDetails": "Python: import chromadb; client = chromadb.PersistentClient(); col = client.get_or_create_collection('name'); col.add(documents=[...], metadatas=[...], ids=[...]); col.query(query_texts=[...], n_results=5).",
        "modalities": ["embeddings"],
    },
    {
        "name": "pgvector",
        "displayName": "pgvector",
        "tagline": "Vector search as a Postgres extension — reuse your existing Postgres for RAG.",
        "icon": "Database",
        "color": "#336791",
        "category": "specialized",
        "kind": "package",
        "popularity": "very-high",
        "bestFor": [
            "RAG without a new database — use existing Postgres",
            "Transactional + vector data in same DB",
            "Supabase / RDS / Aurora integration",
            "Small-to-medium scale (< 100M vectors)",
        ],
        "capabilities": [
            "Postgres extension for vector storage + search",
            "HNSW + IVFFlat indexes",
            "Hybrid search: vector + SQL in one query",
            "Transactional consistency (insert + vector in one tx)",
            "Works with any Postgres provider (RDS, Aurora, Supabase)",
        ],
        "whenToUse": [
            "Already on Postgres — avoid new DB",
            "Need transactional + vector data together",
        ],
        "limitations": [
            "Not built for 1B+ scale (use Milvus / Pinecone)",
            "Index rebuilds can be slow at scale",
        ],
        "samplePrompts": [
            "RAG over 10M customer records + their support tickets in Postgres.",
            "Hybrid query: 'find similar products, in stock, under $100, in category X'.",
            "Recommendation engine: vector similarity + transactional purchase history.",
        ],
        "setupNotes": "Install extension: CREATE EXTENSION vector; (must be in shared_preload_libraries on RDS). Add vector column: ALTER TABLE docs ADD COLUMN embedding vector(1536).",
        "pricingTier": "Free / open-source. Costs only your Postgres instance.",
        "docsUrl": "https://github.com/pgvector/pgvector",
        "availableModels": ["(any embedding model — pgvector stores vectors)"],
        "availableAgents": ["rag-researcher", "hybrid-search", "recommender"],
        "advantages": [
            "Reuse existing Postgres — no new DB",
            "Transactional + vector in same DB",
            "SQL + vector hybrid queries",
            "Works with RDS / Aurora / Supabase / Neon",
        ],
        "businessAdvantages": [
            "No new vendor = lower operational overhead",
            "Transactional consistency = simpler app code",
        ],
        "apiIntegrationDetails": "SQL: CREATE EXTENSION vector; CREATE TABLE docs (id serial, content text, embedding vector(1536)); SELECT * FROM docs ORDER BY embedding <=> $1 LIMIT 10;",
        "modalities": ["embeddings"],
    },
    {
        "name": "redis-vector",
        "displayName": "Redis Vector Search",
        "tagline": "Real-time vector search on Redis — sub-ms latency, hybrid queries, in-memory.",
        "icon": "Database",
        "color": "#dc382d",
        "category": "specialized",
        "kind": "framework",
        "popularity": "high",
        "bestFor": [
            "Real-time vector search (< 1ms latency)",
            "Caching + vector search in same Redis instance",
            "Session-based recommendations (expire vectors)",
            "Existing Redis users adding vector capability",
        ],
        "capabilities": [
            "In-memory vector search — sub-ms latency",
            "HNSW + FLAT indexes",
            "Hybrid queries: vector + Redis hash filters",
            "TTL on vectors — auto-expire stale data",
            "Works with Redis OSS or Redis Enterprise",
        ],
        "whenToUse": [
            "Need sub-ms vector latency (real-time recs)",
            "Already using Redis for caching",
        ],
        "limitations": [
            "Memory-bound — expensive at 1B+ vectors",
            "Less feature-rich than dedicated vector DBs",
        ],
        "samplePrompts": [
            "Real-time product recommendations: query 1M products in <1ms.",
            "Session-based recs: store user session vectors with 30-min TTL.",
            "Hybrid search: vector similarity + price filter + location filter.",
        ],
        "setupNotes": "Self-host: docker run -p 6379:6379 redis/redis-stack. Or use Redis Cloud at redis.com. Python: pip install redis.",
        "pricingTier": "Open-source free (Redis Stack). Redis Cloud: from $30/mo. Enterprise: contact sales.",
        "docsUrl": "https://redis.io/docs/latest/develop/interact/search-and-query/query/vector-search/",
        "availableModels": ["(any embedding model — Redis stores vectors)"],
        "availableAgents": ["real-time-recommender", "session-rag", "cache-search"],
        "advantages": [
            "Sub-ms latency — fastest vector search",
            "Caching + vectors in same Redis",
            "TTL = auto-expire stale vectors",
            "Hybrid queries (vector + Redis filters)",
        ],
        "businessAdvantages": [
            "Real-time recs = better UX for e-commerce",
            "Reuse existing Redis infrastructure",
        ],
        "apiIntegrationDetails": "Python: import redis; r = redis.Redis(); r.execute_command('FT.CREATE', 'idx', 'SCHEMA', 'embedding', 'VECTOR', 'HNSW', 'DIM', 1536, 'TYPE', 'FLOAT32'); r.ft('idx').search(query).",
        "modalities": ["embeddings"],
    },
    {
        "name": "faiss",
        "displayName": "FAISS",
        "tagline": "Meta's open-source library for efficient similarity search — billions of vectors on a single machine.",
        "icon": "Database",
        "color": "#1877f2",
        "category": "specialized",
        "kind": "package",
        "popularity": "high",
        "bestFor": [
            "In-process vector search (no server)",
            "Billions of vectors on a single machine (GPU)",
            "Research / custom vector search pipelines",
            "Building blocks for custom vector DB",
        ],
        "capabilities": [
            "Pure library — no server, no network",
            "GPU-accelerated (cuVS / Raft integration)",
            "Multiple indexes: HNSW, IVF, PQ, OPQ",
            "Sharding + distributed for scale",
            "Binary vectors for ultra-fast search",
        ],
        "whenToUse": [
            "Need in-process vector search (no server overhead)",
            "Have GPU available for indexing",
        ],
        "limitations": [
            "Library only — no persistence / HA / multi-tenant",
            "Requires custom code for production features",
        ],
        "samplePrompts": [
            "Build a 1B-vector index on a single GPU machine with FAISS.",
            "Real-time image search: encode + query in same Python process.",
            "Research: benchmark HNSW vs IVF vs PQ on custom dataset.",
        ],
        "setupNotes": "pip install faiss-cpu (or faiss-gpu). Python: import faiss; index = faiss.IndexFlatL2(d); index.add(vectors); D, I = index.search(query, k).",
        "pricingTier": "Free / open-source (MIT).",
        "docsUrl": "https://faiss.ai",
        "availableModels": ["(any embedding model — FAISS indexes vectors)"],
        "availableAgents": ["in-process-search", "research-pipeline"],
        "advantages": [
            "Pure library — no server overhead",
            "GPU-accelerated (fastest single-machine search)",
            "Multiple index types for scale/cost tradeoff",
            "Battle-tested at Meta scale",
        ],
        "businessAdvantages": [
            "Lowest cost per query (no server to run)",
            "GPU acceleration = highest throughput",
        ],
        "apiIntegrationDetails": "Python: import faiss; index = faiss.IndexHNSWFlat(d, 32); index.add(np_vectors); D, I = index.search(np_query, k=10).",
        "modalities": ["embeddings"],
    },
    {
        "name": "elasticsearch-vector",
        "displayName": "Elasticsearch Vector Search",
        "tagline": "Vector + BM25 + ELSER in one search engine — enterprise-grade with Kibana observability.",
        "icon": "Database",
        "color": "#005571",
        "category": "specialized",
        "kind": "service",
        "popularity": "very-high",
        "bestFor": [
            "Existing Elasticsearch users adding vector search",
            "Hybrid: BM25 + vector in one query",
            "ELSER (Elastic Learned Sparse EncodeR) for out-of-box embeddings",
            "Enterprise observability via Kibana",
        ],
        "capabilities": [
            "Hybrid search: BM25 + kNN vector in one query",
            "ELSER: Elastic's built-in embedding model",
            "ESEmbedding: managed embedding service",
            "Aggregations on vector search results",
            "Enterprise: RBAC, audit logs, security features",
        ],
        "whenToUse": [
            "Already on Elastic for search / logs",
            "Need hybrid search with strong BM25 baseline",
        ],
        "limitations": [
            "Resource-heavy — needs significant JVM tuning",
            "Pricing premium vs dedicated vector DBs",
        ],
        "samplePrompts": [
            "Hybrid search: BM25 keyword + vector on 100M product catalog.",
            "Use ELSER for out-of-box RAG without choosing embeddings.",
            "Real-time search analytics via Kibana dashboards.",
        ],
        "setupNotes": "Self-host: docker.elastic.co. Or use Elastic Cloud at elastic.co. Enable vector search by setting index settings: knn: true.",
        "pricingTier": "Free tier (basic features). Elastic Cloud: from $95/mo. Enterprise: contact sales.",
        "docsUrl": "https://www.elastic.co/guide/en/elasticsearch/reference/current/knn-search.html",
        "availableModels": ["ELSER", "(any embedding model via inference processor)"],
        "availableAgents": ["hybrid-search", "enterprise-rag", "log-analyzer"],
        "advantages": [
            "Hybrid search: BM25 + vector in one query",
            "ELSER = out-of-box embeddings (no model choice)",
            "Kibana observability for search analytics",
            "Enterprise security features (RBAC, audit)",
        ],
        "businessAdvantages": [
            "Reuse existing Elastic investment",
            "Hybrid search improves relevance for keyword-heavy domains",
        ],
        "apiIntegrationDetails": "PUT index with knn: true; POST _search with knn query + bool query for hybrid. Example: { 'knn': { 'field': 'embedding', 'query_vector': [...], 'k': 10 } }.",
        "modalities": ["embeddings"],
    },
    {
        "name": "lancedb",
        "displayName": "LanceDB",
        "tagline": "Serverless vector DB on object storage (S3/Azure) — zero config, scale to billions.",
        "icon": "Database",
        "color": "#0ea5e9",
        "category": "specialized",
        "kind": "framework",
        "popularity": "high",
        "bestFor": [
            "Serverless vector DB on S3 / Azure Blob",
            "Multi-modal: vector + image + text in same table",
            "Zero infra — just open a Lance file",
            "AnythingLLM / RAG apps default storage",
        ],
        "capabilities": [
            "Vectors stored on S3 / Azure Blob — no DB server",
            "Multi-modal: vector + image + text + video in same table",
            "Lance columnar format — fast random access",
            "HNSW + IVF indexes",
            "Embedded (no server) — like DuckDB for vectors",
        ],
        "whenToUse": [
            "Want serverless vector DB without a server",
            "Multi-modal data (vectors + files + images)",
        ],
        "limitations": [
            "Newer project — smaller community",
            "Fewer features than Weaviate / Qdrant",
        ],
        "samplePrompts": [
            "Serverless RAG: store vectors on S3, query from Lambda.",
            "Multi-modal: search by image + text in same Lance table.",
            "AnythingLLM default storage — drop-in vector DB.",
        ],
        "setupNotes": "pip install lancedb. Python: import lancedb; db = lancedb.connect('my_db'); tbl = db.create_table('vectors', data); tbl.search(query_vector).limit(10).to_list().",
        "pricingTier": "Open-source free (LanceDB OSS). LanceDB Cloud: contact sales.",
        "docsUrl": "https://lancedb.github.io/lancedb",
        "availableModels": ["(any embedding model — LanceDB stores vectors)"],
        "availableAgents": ["rag-researcher", "multimodal-search", "s3-rag"],
        "advantages": [
            "Serverless on S3 — no DB server to run",
            "Multi-modal: vector + image + text + video",
            "Lance format = fast random access on object storage",
            "Embedded — no server overhead",
        ],
        "businessAdvantages": [
            "Lowest cost (S3 storage) for vector DB",
            "Multi-modal unlocks novel use cases",
        ],
        "apiIntegrationDetails": "Python: import lancedb; db = lancedb.connect('s3://bucket/db'); tbl = db.create_table('name', data=[{'vector': [...], 'text': '...'}]); tbl.search(query).limit(10).to_list().",
        "modalities": ["embeddings", "vision"],
    },
    # ─── OBSERVABILITY / ANALYTICS ────────────────────────────────────────
    {
        "name": "langsmith",
        "displayName": "LangSmith",
        "tagline": "LangChain's official observability + eval platform — trace, evaluate, debug LLM apps.",
        "icon": "Activity",
        "color": "#1c3c3c",
        "category": "specialized",
        "kind": "service",
        "popularity": "very-high",
        "bestFor": [
            "Tracing LangChain / LangGraph workflows",
            "Eval suites for LLM regression testing",
            "Prompt experimentation + A/B testing",
            "Production monitoring with cost tracking",
        ],
        "capabilities": [
            "Auto-trace LangChain / LangGraph calls",
            "Custom trace any LLM call via SDK",
            "Eval suites: define test cases + scorers",
            "Datasets: golden examples for regression testing",
            "Playground for prompt experimentation",
        ],
        "whenToUse": [
            "Using LangChain / LangGraph in production",
            "Need prompt A/B testing + evals",
        ],
        "limitations": [
            "Best UX with LangChain ecosystem",
            "Premium pricing for teams",
        ],
        "samplePrompts": [
            "Trace a 20-step LangGraph workflow and identify the slowest node.",
            "Set up an eval suite: 50 prompts + custom scorers.",
            "A/B test 3 prompt variants on a 100-example dataset.",
        ],
        "setupNotes": "Sign up at smith.langchain.com, create API key. pip install langsmith. Set LANGSMITH_API_KEY env var — auto-traces LangChain calls.",
        "pricingTier": "Free dev: 5k traces/mo. Plus from $39/mo for 50k traces. Enterprise: contact sales.",
        "docsUrl": "https://docs.smith.langchain.com",
        "availableModels": ["(any — LangSmith is observability, not a model)"],
        "availableAgents": ["observability-layer", "eval-runner", "prompt-tester"],
        "advantages": [
            "Best-in-class LangChain / LangGraph tracing",
            "Eval suites for regression testing",
            "Datasets + playground for prompt dev",
            "Auto-instrumentation — zero code changes",
        ],
        "businessAdvantages": [
            "Production observability reduces LLM app bugs",
            "Eval suites catch prompt regressions",
        ],
        "apiIntegrationDetails": "pip install langsmith; set LANGSMITH_API_KEY env var. Auto-traces LangChain calls. Custom: from langsmith import Client; client.create_run(...).",
        "modalities": ["agents", "tools"],
    },
    {
        "name": "langfuse",
        "displayName": "Langfuse",
        "tagline": "Open-source LLM observability — trace, eval, prompt management. Self-host or cloud.",
        "icon": "Activity",
        "color": "#0ea5e9",
        "category": "specialized",
        "kind": "service",
        "popularity": "very-high",
        "bestFor": [
            "Open-source LLM observability (self-host)",
            "Framework-agnostic (works with any LLM call)",
            "Prompt management with versioning",
            "Cost + latency tracking per request",
        ],
        "capabilities": [
            "Auto-trace LLM calls (OpenAI GenAI SDK, LangChain, etc.)",
            "Custom trace any LLM call via SDK",
            "Prompt management: versioned, A/B tested",
            "Eval: human + LLM-as-judge scorers",
            "Self-hosted on Docker / Kubernetes",
        ],
        "whenToUse": [
            "Need open-source / self-hosted observability",
            "Not using LangChain (LangSmith is LangChain-biased)",
        ],
        "limitations": [
            "Self-hosted requires maintenance",
            "Smaller feature set than LangSmith in some areas",
        ],
        "samplePrompts": [
            "Trace OpenAI calls in production with cost + latency per request.",
            "Version-managed prompts: A/B test v1 vs v2 on production traffic.",
            "LLM-as-judge eval: auto-score outputs on 100-example dataset.",
        ],
        "setupNotes": "Self-host: docker-compose up (langfuse/langfuse-compose). Or use Langfuse Cloud at langfuse.com. pip install langfuse. Auto-traces via OpenAI GenAI SDK.",
        "pricingTier": "Open-source free. Cloud: free up to 50k observations/mo. Pro from $49/mo.",
        "docsUrl": "https://langfuse.com/docs",
        "availableModels": ["(any — Langfuse is observability, not a model)"],
        "availableAgents": ["observability-layer", "prompt-manager", "eval-runner"],
        "advantages": [
            "Open-source — self-host for free",
            "Framework-agnostic (not LangChain-biased)",
            "Prompt management with versioning",
            "LLM-as-judge eval",
        ],
        "businessAdvantages": [
            "Self-host option for regulated industries",
            "Framework-agnostic = no lock-in",
        ],
        "apiIntegrationDetails": "pip install langfuse. Auto-traces via OpenAI GenAI SDK. Custom: from langfuse import Langfuse; langfuse.trace(...).",
        "modalities": ["agents", "tools"],
    },
    {
        "name": "helicone",
        "displayName": "Helicone",
        "tagline": "Proxy-based LLM observability — drop in 1 line, get cost + latency + cache + rate limits.",
        "icon": "Activity",
        "color": "#0ea5e9",
        "category": "specialized",
        "kind": "service",
        "popularity": "high",
        "bestFor": [
            "Quickest LLM observability setup (1 line)",
            "Cost tracking + rate limiting as proxy",
            "Caching to cut LLM spend",
            "Self-hosted option",
        ],
        "capabilities": [
            "Proxy-based: change base_url, get full observability",
            "Cost tracking per request",
            "Caching (exact + semantic) to cut spend",
            "Rate limiting + retry logic",
            "Custom properties on requests for grouping",
        ],
        "whenToUse": [
            "Need observability with zero code changes",
            "Want caching to reduce LLM cost",
        ],
        "limitations": [
            "Less deep than LangSmith for agent traces",
            "Self-hosted requires maintenance",
        ],
        "samplePrompts": [
            "Add caching to OpenAI calls — auto-skip duplicate prompts.",
            "Rate limit per-user via Helicone proxy.",
            "Track cost per feature in production (tag with custom properties).",
        ],
        "setupNotes": "pip install helicone. Set base_url to https://oai.helicone.ai/v1 and add 'Helicone-Auth: <key>' header. That's it.",
        "pricingTier": "Free: 100k requests/mo. Pro from $49/mo for 1M requests. Self-hosted: free.",
        "docsUrl": "https://docs.helicone.ai",
        "availableModels": ["(any — Helicone is a proxy, not a model)"],
        "availableAgents": ["observability-layer", "cache-layer", "rate-limiter"],
        "advantages": [
            "1-line setup — change base_url, done",
            "Caching cuts LLM spend by 30-80%",
            "Rate limiting + retry built-in",
            "Self-host option",
        ],
        "businessAdvantages": [
            "Caching = direct LLM cost savings",
            "Quickest observability win",
        ],
        "apiIntegrationDetails": "Change OpenAI base_url to 'https://oai.helicone.ai/v1'. Add 'Helicone-Auth: Bearer <key>' header. All other code unchanged.",
        "modalities": ["agents", "tools"],
    },
    {
        "name": "portkey",
        "displayName": "Portkey",
        "tagline": "LLM gateway + observability — 1,600+ providers, fallbacks, caching, prompt management.",
        "icon": "Activity",
        "color": "#ef4444",
        "category": "specialized",
        "kind": "service",
        "popularity": "high",
        "bestFor": [
            "Multi-provider LLM gateway with fallbacks",
            "Production observability + prompt mgmt",
            "Caching + rate limiting across providers",
            "Compliance: log all LLM calls for audit",
        ],
        "capabilities": [
            "1,600+ LLM providers via single API",
            "Gateway: fallbacks, retries, load balancing",
            "Prompt management with versioning",
            "Caching: exact + semantic",
            "Observability: traces, cost, latency",
        ],
        "whenToUse": [
            "Need a multi-provider gateway (like OpenRouter + observability)",
            "Want compliance-ready audit logs",
        ],
        "limitations": [
            "Premium pricing for gateway features",
            "Adds a hop (slight latency)",
        ],
        "samplePrompts": [
            "Gateway: OpenAI → Anthropic → Together fallback chain with auto-retry.",
            "Compliance: log all LLM calls for SOC2 audit.",
            "Caching: 30% cache hit rate cuts LLM spend.",
        ],
        "setupNotes": "Sign up at portkey.ai, create a key. Change OpenAI base_url to https://api.portkey.ai/v1. Add 'x-portkey-api-key' header.",
        "pricingTier": "Free: 10k requests/mo. Pro from $49/mo for 1M requests. Enterprise: contact sales.",
        "docsUrl": "https://docs.portkey.ai",
        "availableModels": ["(1,600+ providers via Portkey gateway)"],
        "availableAgents": ["gateway-agent", "compliance-logger", "cache-layer"],
        "advantages": [
            "1,600+ providers via single API",
            "Gateway with fallbacks + load balancing",
            "Caching + rate limiting built-in",
            "Compliance-ready audit logs",
        ],
        "businessAdvantages": [
            "Single vendor for multi-provider gateway + observability",
            "Compliance audit logs unlock regulated industries",
        ],
        "apiIntegrationDetails": "Change OpenAI base_url to 'https://api.portkey.ai/v1'. Add 'x-portkey-api-key: <key>' + 'x-portkey-virtual-key: <provider-key>'.",
        "modalities": ["agents", "tools"],
    },
    {
        "name": "arize-ai",
        "displayName": "Arize AI (Phoenix)",
        "tagline": "LLM + ML observability — Phoenix open-source for tracing, Arize cloud for production.",
        "icon": "Activity",
        "color": "#000000",
        "category": "specialized",
        "kind": "service",
        "popularity": "high",
        "bestFor": [
            "ML + LLM observability in one platform",
            "Phoenix open-source for self-hosted tracing",
            "Drift detection + data quality monitoring",
            "Eval suites for LLM regression testing",
        ],
        "capabilities": [
            "Phoenix OSS: open-source LLM tracing",
            "Arize Cloud: production monitoring at scale",
            "Drift detection (PSI, KL divergence)",
            "Data quality monitoring",
            "Eval: LLM-as-judge + human scoring",
        ],
        "whenToUse": [
            "Need ML + LLM observability (not just LLM)",
            "Want open-source Phoenix for self-hosted",
        ],
        "limitations": [
            "Premium pricing for Arize cloud",
            "Steeper learning curve than Helicone",
        ],
        "samplePrompts": [
            "Trace LangChain calls with Phoenix OSS — self-hosted.",
            "Detect prompt drift: compare this week's prompts to last week's.",
            "LLM-as-judge eval on 1000 production traces.",
        ],
        "setupNotes": "Phoenix: pip install arize-phoenix; phoenix.run(). Arize Cloud: sign up at arize.com, create a key.",
        "pricingTier": "Phoenix OSS: free. Arize Cloud: from $100/mo. Enterprise: contact sales.",
        "docsUrl": "https://docs.arize.com/phoenix",
        "availableModels": ["(any — Arize is observability, not a model)"],
        "availableAgents": ["observability-layer", "drift-detector", "eval-runner"],
        "advantages": [
            "Phoenix OSS = free self-hosted tracing",
            "ML + LLM in one platform (not just LLM)",
            "Drift detection (rare in LLM observability)",
            "LLM-as-judge eval",
        ],
        "businessAdvantages": [
            "ML + LLM coverage = unified observability",
            "Phoenix OSS for cost-sensitive teams",
        ],
        "apiIntegrationDetails": "Phoenix: pip install arize-phoenix; import phoenix as px; px.run(); from openinference.instrumentation.langchain import LangChainInstrumentor; LangChainInstrumentor().instrument().",
        "modalities": ["agents", "tools"],
    },
    {
        "name": "braintrust",
        "displayName": "Braintrust",
        "tagline": "Eval + prompt playground for LLMs — built by ex-Figma / Stripe eng for serious eval workflows.",
        "icon": "Activity",
        "color": "#000000",
        "category": "specialized",
        "kind": "service",
        "popularity": "high",
        "bestFor": [
            "Serious LLM eval workflows (not just traces)",
            "Prompt experimentation with statistical rigor",
            "Custom scorers (LLM-as-judge, code-based, human)",
            "Datasets + experiments for regression testing",
        ],
        "capabilities": [
            "Eval suites with custom scorers (LLM / code / human)",
            "Datasets: golden examples + production samples",
            "Experiments: A/B test prompts / models / configs",
            "Playground: prompt iteration with live eval scores",
            "Auto-logs: trace production calls for re-eval",
        ],
        "whenToUse": [
            "Need rigorous eval (not just observability)",
            "Want statistical comparison of prompt variants",
        ],
        "limitations": [
            "Steeper learning curve than Helicone",
            "Less focus on production monitoring (more on eval)",
        ],
        "samplePrompts": [
            "Eval 5 prompt variants on 200-example dataset with LLM-as-judge.",
            "Regression test: rerun last week's prod traces against new prompt.",
            "Statistical comparison: which model is significantly better?",
        ],
        "setupNotes": "Sign up at braintrust.dev, create a key. pip install braintrust. Auto-evals: from autoevals import LLMClassifier. Custom: import braintrust; braintrust.init(...).",
        "pricingTier": "Free: 1k evals/mo. Pro from $50/mo. Enterprise: contact sales.",
        "docsUrl": "https://www.braintrust.dev/docs",
        "availableModels": ["(any — Braintrust is eval, not a model)"],
        "availableAgents": ["eval-runner", "prompt-tester", "regression-tester"],
        "advantages": [
            "Rigorous eval with custom scorers",
            "Statistical A/B comparison of variants",
            "Auto-logs prod calls for re-eval",
            "Datasets + experiments workflow",
        ],
        "businessAdvantages": [
            "Statistical rigor = confident prompt / model changes",
            "Regression testing reduces prod incidents",
        ],
        "apiIntegrationDetails": "pip install braintrust. from braintrust import Eval; Eval('name', data=lambda: [...], task=lambda input: ..., scores=[...]).",
        "modalities": ["agents", "tools"],
    },
    {
        "name": "weights-biases",
        "displayName": "Weights & Biases",
        "tagline": "ML experiment tracking + LLM observability — W&B Prompts for LLM tracing + evals.",
        "icon": "Activity",
        "color": "#ffb312",
        "category": "specialized",
        "kind": "service",
        "popularity": "very-high",
        "bestFor": [
            "ML teams already on W&B — add LLM tracing",
            "Experiment tracking: hyperparams + metrics",
            "W&B Prompts: LLM tracing + evals",
            "Model evaluation: compare checkpoints",
        ],
        "capabilities": [
            "ML experiment tracking (metrics, params, artifacts)",
            "W&B Prompts: LLM call tracing + evals",
            "Model registry: version control for models",
            "Reports: share insights via interactive dashboards",
            "Sweeps: hyperparameter optimization",
        ],
        "whenToUse": [
            "Already on W&B for ML — add LLM tracing",
            "Need experiment tracking for fine-tuning",
        ],
        "limitations": [
            "Premium pricing for teams",
            "LLM features newer than dedicated observability tools",
        ],
        "samplePrompts": [
            "Track Llama fine-tuning runs: log loss, eval accuracy, hyperparams.",
            "Trace LLM calls in production with W&B Prompts.",
            "Sweep 100 hyperparameter combinations for fine-tuning.",
        ],
        "setupNotes": "Sign up at wandb.ai, create a key. pip install wandb. wandb.init(project='name'). For LLMs: pip install wandb[agents].",
        "pricingTier": "Free: 100GB storage. Pro from $50/user/mo. Enterprise: contact sales.",
        "docsUrl": "https://docs.wandb.ai",
        "availableModels": ["(any — W&B is observability, not a model)"],
        "availableAgents": ["experiment-tracker", "eval-runner", "model-registry"],
        "advantages": [
            "Industry standard for ML experiment tracking",
            "W&B Prompts adds LLM tracing",
            "Model registry for fine-tuned model versioning",
            "Sweeps for hyperparameter optimization",
        ],
        "businessAdvantages": [
            "Unified ML + LLM observability",
            "Industry-standard = easier team onboarding",
        ],
        "apiIntegrationDetails": "pip install wandb; wandb.init(project='name'); wandb.log({'loss': 0.5}). For LLMs: from wandb.sdk.data_types import Trace; wandb.Trace(...).log('root').",
        "modalities": ["agents", "tools"],
    },
    {
        "name": "lunary",
        "displayName": "Lunary",
        "tagline": "Open-source LLM analytics — chat logs, user feedback, prompt iteration in one place.",
        "icon": "Activity",
        "color": "#0ea5e9",
        "category": "specialized",
        "kind": "service",
        "popularity": "medium",
        "bestFor": [
            "Chat log analytics (what users actually say)",
            "User feedback collection (thumbs up/down)",
            "Open-source / self-hosted",
            "Prompt iteration based on real usage",
        ],
        "capabilities": [
            "Chat logs: full conversation history",
            "User feedback: thumbs up/down + comments",
            "Analytics: top questions, sentiment, topics",
            "Prompt versioning + A/B testing",
            "Self-hosted on Docker",
        ],
        "whenToUse": [
            "Need user feedback loop for LLM apps",
            "Want self-hosted analytics",
        ],
        "limitations": [
            "Smaller community than LangSmith / Langfuse",
            "Less focus on eval (more on analytics)",
        ],
        "samplePrompts": [
            "Track thumbs-up rate per prompt variant.",
            "Identify top 10 unanswered questions from chat logs.",
            "Self-host Lunary on Docker for compliance.",
        ],
        "setupNotes": "Self-host: docker-compose up (lunary-ai/lunary). Or use Lunary Cloud at lunary.ai. pip install lunary.",
        "pricingTier": "Open-source free. Cloud: free up to 5k events/mo. Pro from $49/mo.",
        "docsUrl": "https://lunary.ai/docs",
        "availableModels": ["(any — Lunary is analytics, not a model)"],
        "availableAgents": ["analytics-layer", "feedback-collector", "prompt-iterator"],
        "advantages": [
            "User feedback built-in (not just traces)",
            "Self-host option for regulated industries",
            "Chat log analytics — see real usage",
            "Open-source",
        ],
        "businessAdvantages": [
            "User feedback drives product iteration",
            "Self-host for compliance",
        ],
        "apiIntegrationDetails": "pip install lunary; lunary.monitor(openai_client). Or call lunary.track(event, userId, properties) manually.",
        "modalities": ["agents", "tools"],
    },
    {
        "name": "comet-opik",
        "displayName": "Comet Opik",
        "tagline": "Open-source LLM eval + observability from Comet — trace, eval, prompt experiments.",
        "icon": "Activity",
        "color": "#0ea5e9",
        "category": "specialized",
        "kind": "service",
        "popularity": "medium",
        "bestFor": [
            "ML teams already on Comet — add LLM eval",
            "Open-source / self-hosted LLM observability",
            "Eval + prompt experiments in one platform",
            "Multi-LLM comparison",
        ],
        "capabilities": [
            "Auto-trace LLM calls (OpenAI, Anthropic, etc.)",
            "Eval suites: LLM-as-judge + custom scorers",
            "Prompt experiments with A/B comparison",
            "Self-hosted on Docker / Kubernetes",
            "Integration with Comet ML for full-stack ML",
        ],
        "whenToUse": [
            "Already on Comet ML — add LLM eval",
            "Want open-source / self-hosted",
        ],
        "limitations": [
            "Newer product (launched 2024)",
            "Smaller community than Langfuse",
        ],
        "samplePrompts": [
            "Trace + eval LLM calls in production with Opik OSS.",
            "A/B test 3 prompt variants on 100-example dataset.",
            "LLM-as-judge eval: score outputs on helpfulness + safety.",
        ],
        "setupNotes": "Self-host: docker-compose up (comet-ml/opik). Or use Opik Cloud at comet.com. pip install opik.",
        "pricingTier": "Open-source free. Cloud: free up to 1k traces/mo. Pro from $49/mo.",
        "docsUrl": "https://www.comet.com/docs/opik",
        "availableModels": ["(any — Opik is observability, not a model)"],
        "availableAgents": ["observability-layer", "eval-runner", "prompt-tester"],
        "advantages": [
            "Open-source / self-hosted",
            "Integration with Comet ML (unified ML + LLM)",
            "Eval + prompt experiments in one platform",
            "Auto-trace major LLM SDKs",
        ],
        "businessAdvantages": [
            "Unified ML + LLM observability via Comet",
            "Self-host for regulated industries",
        ],
        "apiIntegrationDetails": "pip install opik; import opik; opik.configure(use_local=True). Auto-traces OpenAI/Anthropic calls. Custom: @opik.track decorator.",
        "modalities": ["agents", "tools"],
    },
    # ─── FINE-TUNING ──────────────────────────────────────────────────────
    {
        "name": "unsloth",
        "displayName": "Unsloth",
        "tagline": "2-5x faster LLM fine-tuning on single GPU — Llama, Mistral, Qwen with 50% less memory.",
        "icon": "Zap",
        "color": "#0ea5e9",
        "category": "open-source",
        "kind": "package",
        "popularity": "very-high",
        "bestFor": [
            "Fast LoRA / QLoRA fine-tuning on single GPU",
            "50% less VRAM vs HuggingFace Trainer",
            "Llama / Mistral / Qwen / Gemma supported",
            "Open-source notebooks for one-click fine-tuning",
        ],
        "capabilities": [
            "2-5x faster fine-tuning than HF Trainer",
            "50% less VRAM (Triton kernels)",
            "LoRA + QLoRA + full fine-tuning",
            "Export to vLLM, Ollama, GGUF for deployment",
            "Free Colab notebooks for common models",
        ],
        "whenToUse": [
            "Single GPU fine-tuning (Colab / Kaggle / 1x A100)",
            "Need fast iteration on fine-tuning experiments",
        ],
        "limitations": [
            "Single GPU only (no multi-GPU yet)",
            "Limited to supported model families",
        ],
        "samplePrompts": [
            "Fine-tune Llama-3-8B on a custom dataset in 1 hour on 1x A100.",
            "QLoRA fine-tune Mistral-7B on 16GB GPU (Colab free).",
            "Export fine-tuned model to GGUF for Ollama deployment.",
        ],
        "setupNotes": "pip install unsloth. Or use Colab: github.com/unslothai/unsloth has ready-to-run notebooks. Python: from unsloth import FastLanguageModel; model, tokenizer = FastLanguageModel.from_pretrained(...).",
        "pricingTier": "Free / open-source (Apache 2.0).",
        "docsUrl": "https://github.com/unslothai/unsloth",
        "availableModels": [
            "meta-llama/Llama-3.1-8B", "meta-llama/Llama-3.3-70B-Instruct",
            "mistralai/Mistral-7B-Instruct-v0.3", "Qwen/Qwen2.5-7B-Instruct",
        ],
        "availableAgents": ["fine-tuner", "lora-trainer", "qlora-trainer"],
        "advantages": [
            "2-5x faster than HF Trainer",
            "50% less VRAM = run on cheaper GPUs",
            "Export to multiple formats (GGUF, vLLM, Ollama)",
            "Free Colab notebooks",
        ],
        "businessAdvantages": [
            "Fine-tune on single GPU = 10x cost savings vs multi-GPU",
            "Fast iteration = more experiments",
        ],
        "apiIntegrationDetails": "Python: from unsloth import FastLanguageModel; model = FastLanguageModel.from_pretrained(...); model = FastLanguageModel.get_peft_model(model, ...); trainer.train().",
        "modalities": ["chat", "code"],
    },
    {
        "name": "axolotl",
        "displayName": "Axolotl",
        "tagline": "Config-driven fine-tuning for Llama, Mistral, Qwen — declarative YAML, multi-GPU ready.",
        "icon": "Code2",
        "color": "#0f766e",
        "category": "open-source",
        "kind": "framework",
        "popularity": "high",
        "bestFor": [
            "Multi-GPU fine-tuning with declarative YAML config",
            "Production fine-tuning pipelines (reproducible)",
            "Supports most open models (Llama, Mistral, Qwen, Gemma)",
            "LoRA, QLoRA, full fine-tuning, DPO, ORPO",
        ],
        "capabilities": [
            "YAML config-driven fine-tuning",
            "Multi-GPU (DeepSpeed, FSDP)",
            "LoRA + QLoRA + full + DPO + ORPO + ORPO",
            "Streaming datasets for >RAM datasets",
            "Integration with WandB, Comet, mlflow",
        ],
        "whenToUse": [
            "Need multi-GPU fine-tuning",
            "Want reproducible, config-driven pipeline",
        ],
        "limitations": [
            "Steeper learning curve than Unsloth",
            "More setup overhead (configs)",
        ],
        "samplePrompts": [
            "Multi-GPU LoRA fine-tune Llama-3-70B on 8x A100.",
            "DPO fine-tune Mistral-7B on preference dataset.",
            "Reproducible fine-tuning pipeline via YAML configs in git.",
        ],
        "setupNotes": "git clone github.com/OpenAccess-AI-Collective/axolotl; pip install -e . Create config.yml, run: accelerate launch -m axolotl.cli.train config.yml.",
        "pricingTier": "Free / open-source (Apache 2.0).",
        "docsUrl": "https://github.com/OpenAccess-AI-Collective/axolotl",
        "availableModels": [
            "meta-llama/Meta-Llama-3.1-8B", "meta-llama/Llama-3.3-70B-Instruct",
            "mistralai/Mistral-7B-Instruct-v0.3", "Qwen/Qwen2.5-7B-Instruct",
        ],
        "availableAgents": ["fine-tuner", "dpo-trainer", "production-fine-tuner"],
        "advantages": [
            "Multi-GPU (DeepSpeed, FSDP)",
            "YAML config = reproducible pipelines",
            "Multiple fine-tuning methods (LoRA, DPO, ORPO)",
            "Streaming datasets for large data",
        ],
        "businessAdvantages": [
            "Multi-GPU = faster fine-tuning on large models",
            "Reproducible = auditable training runs",
        ],
        "apiIntegrationDetails": "CLI: accelerate launch -m axolotl.cli.train config.yml. Config YAML specifies base model, dataset, method (LoRA/QLoRA/full/DPO), hyperparams.",
        "modalities": ["chat", "code"],
    },
    {
        "name": "trl",
        "displayName": "TRL (Transformers RL)",
        "tagline": "HuggingFace's library for transformer fine-tuning — SFT, DPO, PPO, reward modeling.",
        "icon": "Code2",
        "color": "#ff9d00",
        "category": "open-source",
        "kind": "package",
        "popularity": "very-high",
        "bestFor": [
            "Standard HF fine-tuning pipeline (SFT, DPO, PPO)",
            "Reward modeling + RLHF",
            "Latest research methods (KTO, ORPO)",
            "Integration with HuggingFace Hub",
        ],
        "capabilities": [
            "SFT (Supervised Fine-Tuning) Trainer",
            "DPO (Direct Preference Optimization)",
            "PPO (Proximal Policy Optimization) for RLHF",
            "Reward modeling + ORPO + KTO",
            "Tight integration with transformers + peft + accelerate",
        ],
        "whenToUse": [
            "Standard HF fine-tuning workflow",
            "Need latest research methods (DPO, KTO, ORPO)",
        ],
        "limitations": [
            "Slower than Unsloth (no kernel optimizations)",
            "More setup than Unsloth for basic LoRA",
        ],
        "samplePrompts": [
            "SFT Llama-3-8B on instruction dataset with TRL.",
            "DPO fine-tune Mistral-7B on preference dataset.",
            "RLHF: train reward model + PPO on Llama-3-8B.",
        ],
        "setupNotes": "pip install trl. Python: from trl import SFTTrainer; trainer = SFTTrainer(model, dataset, args, ...); trainer.train().",
        "pricingTier": "Free / open-source (Apache 2.0).",
        "docsUrl": "https://huggingface.co/docs/trl",
        "availableModels": ["(any HuggingFace model)"],
        "availableAgents": ["sft-trainer", "dpo-trainer", "rlhf-trainer"],
        "advantages": [
            "Official HuggingFace library",
            "Latest methods (DPO, KTO, ORPO, PPO)",
            "Tight HF Hub integration",
            "Standard for research",
        ],
        "businessAdvantages": [
            "Standard tool = easier hiring + onboarding",
            "Latest research methods = state-of-the-art results",
        ],
        "apiIntegrationDetails": "Python: from trl import SFTTrainer, SFTConfig; trainer = SFTTrainer(model=..., args=SFTConfig(...), train_dataset=...); trainer.train().",
        "modalities": ["chat", "code"],
    },
    {
        "name": "torchtune",
        "displayName": "Torchtune",
        "tagline": "PyTorch-native fine-tuning library by Meta — clean configs, multi-GPU ready, Llama-first.",
        "icon": "Code2",
        "color": "#ee4c2c",
        "category": "open-source",
        "kind": "package",
        "popularity": "medium",
        "bestFor": [
            "PyTorch-native fine-tuning (no HF abstractions)",
            "Meta-supported — Llama-first support",
            "Clean YAML configs, easy to customize",
            "Multi-GPU via torch.distributed",
        ],
        "capabilities": [
            "PyTorch-native (no transformers dependency)",
            "LoRA, QLoRA, full fine-tuning",
            "DPO + preference optimization",
            "Multi-GPU via torch.distributed",
            "Clean YAML configs",
        ],
        "whenToUse": [
            "Want PyTorch-native fine-tuning (not HF abstractions)",
            "Llama models — Meta-supported first",
        ],
        "limitations": [
            "Newer than TRL — smaller community",
            "Fewer methods supported",
        ],
        "samplePrompts": [
            "LoRA fine-tune Llama-3.1-8B on 1x A100 with torchtune.",
            "Multi-GPU QLoRA on Llama-3.3-70B across 8x H100.",
            "Custom PyTorch training loop for fine-tuning.",
        ],
        "setupNotes": "pip install torchtune. CLI: tune download meta-llama/Llama-3.1-8B-Instruct; tune run lora_finetune_single_device --config 8B_finetune.yaml.",
        "pricingTier": "Free / open-source (BSD).",
        "docsUrl": "https://pytorch.org/torchtune",
        "availableModels": [
            "meta-llama/Llama-3.1-8B-Instruct", "meta-llama/Llama-3.3-70B-Instruct",
            "meta-llama/Meta-Llama-3.1-405B-Instruct",
        ],
        "availableAgents": ["fine-tuner", "lora-trainer", "pytorch-fine-tuner"],
        "advantages": [
            "PyTorch-native — no HF abstractions",
            "Meta-supported — Llama-first",
            "Clean YAML configs",
            "Multi-GPU via torch.distributed",
        ],
        "businessAdvantages": [
            "Meta backing = long-term support for Llama",
            "PyTorch-native = easier to customize",
        ],
        "apiIntegrationDetails": "CLI: tune run lora_finetune_single_device --config <config>.yaml. Config YAML specifies model, dataset, hyperparams.",
        "modalities": ["chat", "code"],
    },
    {
        "name": "llama-factory",
        "displayName": "Llama Factory",
        "tagline": "Low-code fine-tuning web UI — fine-tune 100+ models without writing Python.",
        "icon": "Code2",
        "color": "#0ea5e9",
        "category": "open-source",
        "kind": "framework",
        "popularity": "high",
        "bestFor": [
            "Non-developer fine-tuning (web UI)",
            "100+ supported models out of the box",
            "LoRA, QLoRA, DPO, ORPO, full fine-tuning",
            "Chinese-language documentation + community",
        ],
        "capabilities": [
            "Web UI for fine-tuning (no code)",
            "100+ supported models (Llama, Qwen, Mistral, etc.)",
            "Multiple methods: SFT, DPO, ORPO, KTO, RLHF",
            "Export to GGUF, vLLM, Ollama",
            "Multi-GPU training",
        ],
        "whenToUse": [
            "Non-developer wants to fine-tune",
            "Want 100+ model support without writing configs",
        ],
        "limitations": [
            "Web UI can be slow for large experiments",
            "Less flexible than TRL / Axolotl for custom setups",
        ],
        "samplePrompts": [
            "Web UI: upload dataset, select Llama-3-8B, click fine-tune, download GGUF.",
            "Multi-GPU LoRA on Llama-3.3-70B across 4x A100.",
            "Export fine-tuned model for Ollama deployment.",
        ],
        "setupNotes": "git clone github.com/hiyouga/LLaMA-Factory; pip install -e . Web UI: llamafactory-cli webui. CLI: llamafactory-cli train config.yaml.",
        "pricingTier": "Free / open-source (Apache 2.0).",
        "docsUrl": "https://llamafactory.readthedocs.io",
        "availableModels": [
            "meta-llama/Llama-3.1-8B-Instruct", "Qwen/Qwen2.5-7B-Instruct",
            "mistralai/Mistral-7B-Instruct-v0.3", "(100+ models supported)",
        ],
        "availableAgents": ["web-ui-fine-tuner", "lora-trainer", "no-code-fine-tuner"],
        "advantages": [
            "Web UI = no code required",
            "100+ models supported",
            "Multiple fine-tuning methods",
            "Export to multiple deployment formats",
        ],
        "businessAdvantages": [
            "Non-developers can fine-tune (analysts, PMs)",
            "100+ models = widest coverage",
        ],
        "apiIntegrationDetails": "Web UI: llamafactory-cli webui. CLI: llamafactory-cli train config.yaml. API: REST endpoints for programmatic control.",
        "modalities": ["chat", "code"],
    },
    # ─── PROMPT ENGINEERING ───────────────────────────────────────────────
    {
        "name": "promptfoo",
        "displayName": "Promptfoo",
        "tagline": "Test + eval prompts as code — CLI-driven, 100+ assertions, works with any LLM provider.",
        "icon": "Wrench",
        "color": "#f59e0b",
        "category": "orchestration",
        "kind": "package",
        "popularity": "high",
        "bestFor": [
            "Testing prompts as code (CI/CD integration)",
            "100+ assertion types (contains, regex, LLM-as-judge)",
            "A/B testing multiple prompt variants",
            "Red-teaming / adversarial prompt testing",
        ],
        "capabilities": [
            "YAML config for prompts + tests",
            "100+ assertions (contains, regex, javascript, LLM-as-judge)",
            "Multi-provider comparison in one test run",
            "Red-team: auto-generate adversarial prompts",
            "CLI + CI/CD integration",
        ],
        "whenToUse": [
            "Need CI/CD for prompts (regression tests)",
            "Want adversarial testing (red-team)",
        ],
        "limitations": [
            "CLI-focused — no web UI for non-devs",
            "Setup overhead for first test suite",
        ],
        "samplePrompts": [
            "CI test: every PR runs promptfoo eval on 50 prompts + 5 assertions each.",
            "Red-team: auto-generate 100 adversarial prompts, check for jailbreaks.",
            "Compare 5 LLM providers on same prompt suite.",
        ],
        "setupNotes": "npm install -g promptfoo. Create promptfooconfig.yaml. Run: promptfoo eval. View: promptfoo view.",
        "pricingTier": "Free / open-source (MIT).",
        "docsUrl": "https://www.promptfoo.dev/docs/intro",
        "availableModels": ["(any LLM provider via API)"],
        "availableAgents": ["prompt-tester", "red-teamer", "eval-runner"],
        "advantages": [
            "Code-as-config — CI/CD integration",
            "100+ assertion types",
            "Red-team testing built-in",
            "Multi-provider comparison",
        ],
        "businessAdvantages": [
            "Regression tests catch prompt breakage before prod",
            "Red-team reduces security incidents",
        ],
        "apiIntegrationDetails": "npm install -g promptfoo. Create promptfooconfig.yaml with prompts, providers, tests. Run: promptfoo eval. View results: promptfoo view.",
        "modalities": ["agents", "tools"],
    },
    {
        "name": "prompty",
        "displayName": "Prompty",
        "tagline": "Microsoft's prompt format + runtime — .prompty files, evals, and tracing.",
        "icon": "BookOpen",
        "color": "#0078d4",
        "category": "orchestration",
        "kind": "package",
        "popularity": "medium",
        "bestFor": [
            "Microsoft ecosystem (Azure OpenAI, Semantic Kernel)",
            "Prompt-as-file (.prompty format)",
            "Eval + tracing built-in",
            "VS Code extension for prompt dev",
        ],
        "capabilities": [
            ".prompty file format (frontmatter + template)",
            "Multi-language runtime (Python, JS, C#)",
            "Eval suites: ground-truth comparison",
            "Tracing via OpenTelemetry",
            "VS Code extension for prompt iteration",
        ],
        "whenToUse": [
            "Already on Microsoft / Azure stack",
            "Want .prompty files (prompt-as-code)",
        ],
        "limitations": [
            "Microsoft-biased (best on Azure)",
            "Smaller community than promptfoo",
        ],
        "samplePrompts": [
            "Create .prompty files for a 5-step RAG pipeline.",
            "Eval suite: 100 prompts + ground-truth expected outputs.",
            "VS Code: iterate on prompt + run eval inline.",
        ],
        "setupNotes": "pip install prompty. Create hello.prompty file. Run: prompty eval hello.prompty. VS Code: install Prompty extension.",
        "pricingTier": "Free / open-source (MIT).",
        "docsUrl": "https://microsoft.github.io/prompty",
        "availableModels": ["(any LLM provider, but best on Azure OpenAI)"],
        "availableAgents": ["prompt-tester", "eval-runner"],
        "advantages": [
            "Prompt-as-file (.prompty format)",
            "VS Code extension for prompt dev",
            "Multi-language runtime",
            "Tracing via OpenTelemetry",
        ],
        "businessAdvantages": [
            "Microsoft stack integration",
            "Prompt-as-file = version-controlled prompts",
        ],
        "apiIntegrationDetails": "pip install prompty. Create .prompty file with frontmatter (model, params) + template. Run: prompty run file.prompty. Or import in Python.",
        "modalities": ["agents", "tools"],
    },
    {
        "name": "orq-ai",
        "displayName": "Orq.ai",
        "tagline": "Prompt collaboration platform — manage, version, A/B test prompts across teams.",
        "icon": "BookOpen",
        "color": "#0ea5e9",
        "category": "orchestration",
        "kind": "service",
        "popularity": "medium",
        "bestFor": [
            "Non-developer prompt management (PMs, content teams)",
            "Versioning + A/B testing prompts",
            "Collaboration across product / dev / legal",
            "Audit logs for compliance",
        ],
        "capabilities": [
            "Web UI for prompt management",
            "Versioning + rollback",
            "A/B testing with statistical comparison",
            "Collaboration: comments, approvals",
            "API + SDKs for runtime prompt fetch",
        ],
        "whenToUse": [
            "Non-developers need to edit prompts",
            "Need audit trail for compliance",
        ],
        "limitations": [
            "Premium pricing",
            "Adds external dependency for prompt delivery",
        ],
        "samplePrompts": [
            "PM iterates on customer-support prompt without dev involvement.",
            "A/B test 3 prompt variants on 10% of prod traffic.",
            "Legal reviews prompt changes via approval workflow.",
        ],
        "setupNotes": "Sign up at orq.ai, create a workspace. Fetch prompts at runtime via API: GET https://api.orq.ai/v1/prompts/<key> with 'Authorization: Bearer <key>'.",
        "pricingTier": "Free: 1k prompts/mo. Pro from $49/mo. Enterprise: contact sales.",
        "docsUrl": "https://docs.orq.ai",
        "availableModels": ["(any LLM provider — Orq delivers prompts)"],
        "availableAgents": ["prompt-manager", "ab-tester", "collaboration-platform"],
        "advantages": [
            "Non-developer-friendly web UI",
            "Versioning + rollback",
            "A/B testing with stats",
            "Audit logs for compliance",
        ],
        "businessAdvantages": [
            "Non-developers can iterate on prompts",
            "Compliance audit trail",
        ],
        "apiIntegrationDetails": "GET https://api.orq.ai/v1/prompts/<key> with 'Authorization: Bearer <key>'. Returns prompt + variables + metadata. Render client-side.",
        "modalities": ["agents", "tools"],
    },
]


def to_ts_entry(d: dict) -> str:
    def arr(items):
        return "[" + ", ".join(f'"{i}"' for i in items) + "]"

    lines = ["  {"]
    lines.append(f"    name: `{d['name']}`,")
    lines.append(f"    displayName: `{d['displayName']}`,")
    lines.append(f"    tagline: `{d['tagline']}`,")
    lines.append(f"    icon: `{d['icon']}`,")
    lines.append(f"    color: `{d['color']}`,")
    lines.append(f"    category: `{d['category']}`,")
    lines.append(f"    kind: `{d['kind']}`,")
    lines.append(f"    popularity: `{d['popularity']}`,")
    lines.append("    bestFor: [")
    for b in d["bestFor"]:
        lines.append(f"    `{b}`,")
    lines.append("    ],")
    lines.append("    capabilities: [")
    for c in d["capabilities"]:
        lines.append(f"    `{c}`,")
    lines.append("    ],")
    lines.append("    whenToUse: [")
    for w in d["whenToUse"]:
        lines.append(f"    `{w}`,")
    lines.append("    ],")
    lines.append("    limitations: [")
    for l in d["limitations"]:
        lines.append(f"    `{l}`,")
    lines.append("    ],")
    lines.append("    samplePrompts: [")
    for s in d["samplePrompts"]:
        lines.append(f"    `{s}`,")
    lines.append("    ],")
    lines.append(f"    setupNotes: `{d['setupNotes']}`,")
    lines.append(f"    pricingTier: `{d['pricingTier']}`,")
    lines.append(f"    docsUrl: `{d['docsUrl']}`,")
    lines.append("    availableModels: [")
    for m in d["availableModels"]:
        lines.append(f"    `{m}`,")
    lines.append("    ],")
    lines.append("    availableAgents: [")
    for a in d["availableAgents"]:
        lines.append(f"    `{a}`,")
    lines.append("    ],")
    lines.append("    advantages: [")
    for ad in d["advantages"]:
        lines.append(f"    `{ad}`,")
    lines.append("    ],")
    lines.append("    businessAdvantages: [")
    for ba in d["businessAdvantages"]:
        lines.append(f"    `{ba}`,")
    lines.append("    ],")
    lines.append(f"    apiIntegrationDetails: `{d['apiIntegrationDetails']}`,")
    lines.append(f"    modalities: {arr(d['modalities'])},")
    lines.append("  },")
    return "\n".join(lines)


def main() -> int:
    if not FILE.exists():
        print(f"ERROR: {FILE} not found", file=sys.stderr)
        return 1

    src = FILE.read_text()

    start_match = re.search(
        r"export const PROVIDER_BENEFITS:\s*ProviderBenefit\[\]\s*=\s*\[",
        src,
    )
    if not start_match:
        print("ERROR: could not locate PROVIDER_BENEFITS array start", file=sys.stderr)
        return 2

    end_match = re.search(r"\n\];\n", src[start_match.end():])
    if not end_match:
        print("ERROR: could not locate PROVIDER_BENEFITS array end", file=sys.stderr)
        return 3

    insert_at = start_match.end() + end_match.start()

    added = []
    skipped = []
    blocks = []
    for entry in ENTRIES:
        name_pat = re.compile(
            r"^\s*name:\s*`" + re.escape(entry["name"]) + r"`\s*,\s*$",
            re.MULTILINE,
        )
        if name_pat.search(src):
            skipped.append(entry["name"])
            continue
        blocks.append(to_ts_entry(entry))
        added.append(entry["name"])

    if not blocks:
        print(f"All {len(ENTRIES)} entries already present. "
              f"(Skipped: {', '.join(skipped)})")
        return 0

    new_chunk = "\n" + "\n".join(blocks) + "\n"
    new_src = src[:insert_at] + new_chunk + src[insert_at:]
    FILE.write_text(new_src)

    print(f"Inserted {len(added)} new entries: {', '.join(added)}")
    if skipped:
        print(f"Skipped (already present): {', '.join(skipped)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
