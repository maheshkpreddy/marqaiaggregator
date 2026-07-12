#!/usr/bin/env python3
"""
Append the 8 missing open-source AI developer tools from the Alexsandu
Substack article "20 Popular Open Source AI Developer Tools" to
src/lib/provider-benefits.ts.

Missing tools (cross-referenced against the existing 130 entries):
  1. ColossalAI      — distributed training parallelism
  2. DeepSpeed       — Microsoft deep-learning optimization library
  3. Ray             — Anyscale unified distributed compute framework
  4. Diffusers       — Hugging Face diffusion models (image/audio/3D)
  5. Flowise         — low-code drag-and-drop LLM orchestration
  6. Mindsdb         — automated ML pipelines over enterprise data
  7. MLC LLM         — Machine Learning Compilation for LLM deployment
  8. Unity ML Agents — game/simulation environments for training agents

Idempotent: re-running will not duplicate entries — checks for the
`name:` key first and skips if present.

Appends just before the closing `];` of PROVIDER_BENEFITS.
"""

from pathlib import Path
import re
import sys

FILE = Path("/home/z/my-project/src/lib/provider-benefits.ts")

# ── New entries ────────────────────────────────────────────────────────────
ENTRIES = [
    # ── ColossalAI ─────────────────────────────────────────────────────────
    {
        "name": "colossalai",
        "block": """  {
    name: `colossalai`,
    displayName: `ColossalAI`,
    tagline: `Distributed training & inference parallelism for giant models — data, pipeline, tensor, and sequence parallelism in a few lines of code.`,
    icon: `Layers`,
    color: `#6366f1`,
    category: `orchestration`,
    kind: `package`,
    popularity: `medium`,
    bestFor: [
      `Training 10B–100B+ parameter models on multi-GPU clusters`,
      `Multi-dimensional parallelism (data + pipeline + tensor + sequence)`,
      `Zero-redundancy optimizer (ZeRO) for memory-efficient training`,
      `Automatic parallelization management without manual sharding code`,
      `Mixed-precision training with FP16/BF16`,
    ],
    capabilities: [
      `Run distributed training jobs with a single colossalai.launch(...) call`,
      `Switch between parallelism strategies via config — no code rewrite`,
      `Serve large models for inference with sequence parallelism`,
      `Fine-tune Llama, OPT, BLOOM and other open-weight families at scale`,
      `Integrate with HuggingFace Transformers and PyTorch Lightning`,
    ],
    whenToUse: [
      `Your model won't fit on a single GPU and you need pipeline + tensor parallelism`,
      `You want automatic parallelism management instead of hand-writing sharding`,
      `You're pre-training or continued-pre-training a multi-billion-param LLM`,
      `You need ZeRO-3 with offload to CPU/NVMe for extreme memory savings`,
    ],
    limitations: [
      `Steep learning curve for advanced parallelism strategies`,
      `Smaller community than DeepSpeed — fewer answered StackOverflow threads`,
      `Primarily PyTorch-only (TF/JAX not first-class)`,
      `Best results require InfiniBand-connected GPU clusters`,
    ],
    samplePrompts: [
      `Write a ColossalAI training script for a 7B Llama model using pipeline + tensor parallelism across 8 GPUs.`,
      `Compare ColossalAI's ZeRO-3 with DeepSpeed ZeRO-3 — when does each win?`,
      `Show me the config file for mixed-precision training with sequence parallelism enabled.`,
    ],
    setupNotes: `pip install colossalai. For multi-GPU training, launch with 'colossalai run --nproc_per_node=8 train.py'. Requires a CUDA-capable GPU cluster; InfiniBand recommended for pipeline parallelism.`,
    pricingTier: `Free open-source (Apache 2.0). Paid enterprise support and hosted training available from HPC-AI Tech.`,
    docsUrl: `https://www.colossalai.org/`,
    availableModels: [
      `Llama-2/3`,
      `OPT`,
      `BLOOM`,
      `GPT-2/3`,
      `T5`,
      `custom`,
    ],
    availableAgents: [
      `research`,
      `fullstack_dev`,
    ],
    advantages: [
      `Multi-dimensional parallelism in one framework`,
      `Automatic parallelism management (no manual sharding code)`,
      `ZeRO-1/2/3 with CPU/NVMe offload`,
      `Sequence parallelism for long-context training`,
      `Native CUDA kernels for fused optimizers`,
    ],
    businessAdvantages: [
      `Train giant models on commodity GPU clusters — no need for DGX-class nodes`,
      `Apache 2.0 license allows commercial use without restriction`,
      `Reduces GPU-hours via memory-efficient training`,
      `Active roadmap from HPC-AI Tech with enterprise SLA option`,
    ],
    apiIntegrationDetails: `Python API: 'import colossalai; colossalai.launch(config, rank, world_size, host, port)'. No hosted REST endpoint — runs on your cluster. Inference: 'from colossalai.inference import torch_engine; engine = torch_engine.InferenceEngine(model, ...)'.`,
    modalities: ["code", "tools"],
  },""",
    },
    # ── DeepSpeed ──────────────────────────────────────────────────────────
    {
        "name": "deepspeed",
        "block": """  {
    name: `deepspeed`,
    displayName: `DeepSpeed`,
    tagline: `Microsoft's deep-learning optimization library for distributed training & inference of very large models on thousands of GPUs.`,
    icon: `Gauge`,
    color: `#0078d4`,
    category: `orchestration`,
    kind: `package`,
    popularity: `high`,
    bestFor: [
      `Training 100B+ parameter models on multi-node GPU clusters`,
      `ZeRO-1/2/3 redundancy optimization for memory savings`,
      `High-throughput inference with DeepSpeed-MII`,
      `Mixed-precision training with BF16/FP16`,
      `Long-context training with sequence parallelism`,
    ],
    capabilities: [
      `Train models with ZeRO-3 offload to CPU/NVMe for extreme memory savings`,
      `Run inference with Continuous Batching via DeepSpeed-FastGen`,
      `Use DeepSpeed-Chat for RLHF training of chat models`,
      `MoE (Mixture-of-Experts) training with expert parallelism`,
      `Multi-node training on Azure, AWS, on-prem clusters`,
    ],
    whenToUse: [
      `You're training at scale (100B+ params) and need proven, battle-tested ZeRO`,
      `You want the most mature distributed training ecosystem`,
      `You need RLHF/DPO fine-tuning of chat models with DeepSpeed-Chat`,
      `You're deploying LLMs for high-throughput inference (DeepSpeed-MII)`,
    ],
    limitations: [
      `Configuration is JSON-driven and verbose`,
      `Best results require InfiniBand-connected GPU clusters`,
      `Smaller community focus on single-GPU / small-cluster use cases`,
      `MoE training has a steeper learning curve than dense models`,
    ],
    samplePrompts: [
      `Write a DeepSpeed ZeRO-3 config for training a 13B model on 8 A100 GPUs with CPU offload.`,
      `Compare DeepSpeed-MII vs vLLM for inference throughput on Llama-3-70B.`,
      `Show me a DeepSpeed-Chat script for RLHF fine-tuning of a 7B base model.`,
    ],
    setupNotes: `pip install deepspeed. For multi-node: use 'deepspeed --num_gpus=8 --num_nodes=4 train.py'. Requires CUDA GPUs; InfiniBand recommended for multi-node. Azure ML and AWS Deep Learning AMIs ship with DeepSpeed pre-installed.`,
    pricingTier: `Free open-source (Apache 2.0). DeepSpeed on Azure offers managed training; otherwise run on your own GPUs.`,
    docsUrl: `https://www.deepspeed.ai/`,
    availableModels: [
      `Megatron-LM`,
      `Llama-2/3`,
      `BLOOM`,
      `OPT`,
      `GPT-NeoX`,
      `custom`,
    ],
    availableAgents: [
      `research`,
      `fullstack_dev`,
    ],
    advantages: [
      `Most mature ZeRO implementation (ZeRO-1/2/3 + offload)`,
      `DeepSpeed-MII for high-throughput inference with Continuous Batching`,
      `DeepSpeed-Chat for one-shot RLHF/DPO training`,
      `MoE expert parallelism built-in`,
      `Battle-tested at Microsoft on 530B-param models`,
    ],
    businessAdvantages: [
      `Apache 2.0 license — fully commercial`,
      `Tight integration with Azure ML for managed training`,
      `Reduces GPU-hours via ZeRO memory savings`,
      `Backed by Microsoft research — long-term support`,
    ],
    apiIntegrationDetails: `Python API: 'import deepspeed; model_engine, optimizer, _, _ = deepspeed.initialize(model=model, optimizer=optimizer, config=ds_config)'. Inference: 'from deepspeed.inference import DeepSpeedEngine; engine = DeepSpeedEngine(model, ...)'. No REST endpoint.`,
    modalities: ["code", "tools"],
  },""",
    },
    # ── Ray ────────────────────────────────────────────────────────────────
    {
        "name": "ray",
        "block": """  {
    name: `ray`,
    displayName: `Ray`,
    tagline: `Anyscale's unified compute framework for scaling AI and Python workloads — distributed training, tuning, serving, and RL from laptop to cluster.`,
    icon: `Network`,
    color: `#0288d1`,
    category: `orchestration`,
    kind: `framework`,
    popularity: `high`,
    bestFor: [
      `Scaling Python workloads from laptop to 1000-node cluster with no code changes`,
      `Distributed hyperparameter tuning with Ray Tune`,
      `Model serving with Ray Serve (low-latency, autoscaling)`,
      `Reinforcement learning with Ray RLlib`,
      `Distributed data processing with Ray Data`,
    ],
    capabilities: [
      `Run distributed training of PyTorch/TensorFlow/HuggingFace models`,
      `Serve models for inference with Ray Serve — autoscaling and canary deploys`,
      `Tune hyperparameters across thousands of trials in parallel`,
      `Train RL agents with Ray RLlib across multi-node clusters`,
      `Process large datasets with Ray Data (replacement for Spark)`,
    ],
    whenToUse: [
      `You want a single framework for training + serving + tuning + data`,
      `You're scaling beyond a single machine but want to keep Python-native code`,
      `You need online inference with autoscaling (Ray Serve)`,
      `You're doing reinforcement learning at scale (RLlib)`,
    ],
    limitations: [
      `Cluster setup can be complex (Ray autoscaler / KubeRay)`,
      `Memory footprint per worker is higher than bare multiprocessing`,
      `Object store in-memory — large datasets may spill to disk`,
      `Best with stateless workloads; stateful RLlib workflows need care`,
    ],
    samplePrompts: [
      `Write a Ray Serve deployment that wraps a HuggingFace text-generation model with autoscaling.`,
      `Set up Ray Tune to hyperparameter-search a PyTorch classifier across 100 trials on a 4-node cluster.`,
      `Show me a Ray RLlib PPO config for training an agent in a Gymnasium environment.`,
    ],
    setupNotes: `pip install ray. For a single machine: 'ray.init()'. For a cluster: 'ray start --head' on the head node, 'ray start --address=<head-ip>:6379' on workers. Use KubeRay for Kubernetes. Anyscale offers a managed Ray platform.`,
    pricingTier: `Free open-source (Apache 2.0). Anyscale offers a managed Ray platform with pay-as-you-go pricing.`,
    docsUrl: `https://docs.ray.io/`,
    availableModels: [
      `any PyTorch / TF / HF model`,
      `RLlib-supported algorithms (PPO, DQN, SAC, A2C, IMPALA)`,
      `custom`,
    ],
    availableAgents: [
      `research`,
      `devops`,
      `fullstack_dev`,
    ],
    advantages: [
      `Unified API for training, serving, tuning, RL, and data`,
      `Scales from laptop to 1000+ node cluster with no code changes`,
      `Ray Serve for production-grade autoscaling inference`,
      `Native integration with PyTorch, TensorFlow, HuggingFace, Scikit-learn`,
      `Ray Tune is the most flexible hyperparameter search library`,
    ],
    businessAdvantages: [
      `Apache 2.0 license — fully commercial`,
      `Anyscale managed platform eliminates cluster ops`,
      `Reduces infrastructure code — focus on ML, not distributed systems`,
      `Battle-tested at OpenAI, Uber, Shopify, Instacart`,
    ],
    apiIntegrationDetails: `Python API: 'import ray; ray.init(); @ray.remote def f(x): ...; ray.get([f.remote(i) for i in range(4)])'. Serving: 'from ray import serve; serve.start(); serve.run(my_app)'. No hosted REST endpoint unless using Anyscale.`,
    modalities: ["code", "tools", "agents"],
  },""",
    },
    # ── Diffusers ──────────────────────────────────────────────────────────
    {
        "name": "diffusers",
        "block": """  {
    name: `diffusers`,
    displayName: `Hugging Face Diffusers`,
    tagline: `Library for fine-tuning and deploying pretrained diffusion models — images, audio, and 3D object generation.`,
    icon: `Image`,
    color: `#ff9d00`,
    category: `specialized`,
    kind: `package`,
    popularity: `high`,
    bestFor: [
      `Text-to-image generation with Stable Diffusion, SDXL, Flux`,
      `Image-to-image editing, inpainting, and ControlNet`,
      `Text-to-audio and text-to-3D with AudioLDM, Shap-E`,
      `Fine-tuning diffusion models with LoRA / DreamBooth`,
      `Custom noise schedulers for speed-vs-quality trade-offs`,
    ],
    capabilities: [
      `Run any diffusion model from Hugging Face Hub with 3 lines of Python`,
      `Fine-tune Stable Diffusion on your images with DreamBooth / LoRA`,
      `Build image-editing pipelines (inpaint, outpaint, ControlNet)`,
      `Switch noise schedulers (DDIM, PNDM, Euler, DPM-Solver) at runtime`,
      `Optimize for low VRAM with xFormers, fp16, sequential CPU offload`,
    ],
    whenToUse: [
      `You need text-to-image or image-to-image in your app`,
      `You want to fine-tune Stable Diffusion / SDXL on your brand assets`,
      `You're building an image editing feature (inpaint, ControlNet, IP-Adapter)`,
      `You need a unified API across multiple diffusion model families`,
    ],
    limitations: [
      `Diffusion inference is slow compared to GANs (seconds, not milliseconds)`,
      `VRAM-hungry — SDXL needs ~16GB, Flux needs ~24GB without offload`,
      `Fine-tuning DreamBooth requires careful prompt engineering to avoid overfitting`,
      `3D and video diffusion models are still experimental`,
    ],
    samplePrompts: [
      `Write a Diffusers pipeline for text-to-image generation with SDXL Turbo and DPM-Solver scheduler.`,
      `Show me a DreamBooth training script to fine-tune Stable Diffusion on 10 product photos.`,
      `Build an inpainting pipeline that uses ControlNet depth conditioning.`,
    ],
    setupNotes: `pip install diffusers transformers accelerate torch. For low-VRAM: also install xFormers. Models auto-download from Hugging Face Hub on first use. For inference-only on consumer GPUs, use 'enable_model_cpu_offload()'.`,
    pricingTier: `Free open-source (Apache 2.0). Models are free on Hugging Face Hub; paid Pro and Enterprise Hub for private models.`,
    docsUrl: `https://huggingface.co/docs/diffusers/`,
    availableModels: [
      `stable-diffusion-2.1`,
      `stable-diffusion-xl`,
      `stable-diffusion-3`,
      `flux.1-dev`,
      `flux.1-schnell`,
      `kandinsky-2/3`,
      `audioldm`,
      `shap-e`,
    ],
    availableAgents: [
      `fullstack_dev`,
      `research`,
    ],
    advantages: [
      `Unified API across 500+ diffusion model checkpoints`,
      `LoRA / DreamBooth fine-tuning built-in`,
      `Pluggable noise schedulers for runtime speed-vs-quality tuning`,
      `Memory-efficient inference with CPU offload and xFormers`,
      `Tight integration with Hugging Face Hub`,
    ],
    businessAdvantages: [
      `Apache 2.0 — fully commercial`,
      `Free model hosting on Hugging Face Hub`,
      `Reduces time-to-market for any image/audio generation feature`,
      `Largest community of diffusion model fine-tuners`,
    ],
    apiIntegrationDetails: `Python API: 'from diffusers import StableDiffusionPipeline; pipe = StableDiffusionPipeline.from_pretrained("runwayml/stable-diffusion-v1-5"); image = pipe("a photo of an astronaut").images[0]'. For hosting, use Hugging Face Inference Endpoints or deploy with FastAPI.`,
    modalities: ["image", "code", "tools"],
  },""",
    },
    # ── Flowise ────────────────────────────────────────────────────────────
    {
        "name": "flowise",
        "block": """  {
    name: `flowise`,
    displayName: `Flowise`,
    tagline: `Open-source low-code drag-and-drop tool to build customized LLM orchestration flows and AI agents visually.`,
    icon: `Workflow`,
    color: `#22c55e`,
    category: `orchestration`,
    kind: `framework`,
    popularity: `medium`,
    bestFor: [
      `Building LLM apps visually without writing orchestration code`,
      `Prototyping LangChain / LlamaIndex flows with a drag-and-drop canvas`,
      `Non-developer teams composing AI agents and chains`,
      `RAG pipelines with vector stores and document loaders`,
      `Self-hosted alternative to Voiceflow / Botpress`,
    ],
    capabilities: [
      `Drag and drop LangChain components into custom chains and agents`,
      `Connect to OpenAI, Anthropic, Ollama, LocalAI, HuggingFace, Cohere`,
      `Embed chatbots on external sites with the embed widget`,
      `Use vector stores (Pinecone, Qdrant, Supabase, FAISS) for RAG`,
      `Expose flows as REST APIs for app integration`,
    ],
    whenToUse: [
      `You want to prototype LLM apps visually before writing code`,
      `Your team has more domain experts than Python developers`,
      `You need a self-hosted, no-code alternative to LangFlow / Voiceflow`,
      `You want to expose LangChain flows as REST APIs without a backend`,
    ],
    limitations: [
      `Not ideal for production-scale workloads — single-instance by default`,
      `Limited version control — flows are stored in SQLite by default`,
      `Less flexible than raw LangChain code for complex control flow`,
      `Best for prototyping; production deployments need custom backends`,
    ],
    samplePrompts: [
      `Design a Flowise flow for a customer-support RAG chatbot that queries a Supabase vector store.`,
      `Show me how to expose a Flowise agent as a REST API endpoint.`,
      `Build a Flowise chain that summarizes a PDF and posts the summary to Slack.`,
    ],
    setupNotes: `npm install -g flowise; flowise start. Or use Docker: 'docker run -d -p 3000:3000 flowiseai/flowise'. UI is at http://localhost:3000. Default storage is SQLite; PostgreSQL and MySQL supported.`,
    pricingTier: `Free open-source (Apache 2.0). Flowise Cloud offers managed hosting with team collaboration (paid).`,
    docsUrl: `https://docs.flowiseai.com/`,
    availableModels: [
      `OpenAI GPT-4o / 3.5`,
      `Anthropic Claude`,
      `Ollama (any local model)`,
      `HuggingFace Inference`,
      `Cohere`,
      `any LangChain-supported model`,
    ],
    availableAgents: [
      `general`,
      `business_analyst`,
    ],
    advantages: [
      `Visual drag-and-drop — no code required for basic chains`,
      `Native LangChain integration (uses LangChain.js under the hood)`,
      `Embeddable chat widget for external sites`,
      `REST API exposure for every flow`,
      `Multi-user with role-based access (Flowise Cloud)`,
    ],
    businessAdvantages: [
      `Apache 2.0 — fully commercial, self-hostable`,
      `Cuts prototyping time from days to hours`,
      `Non-developers can compose and iterate on LLM flows`,
      `Flowise Cloud eliminates ops for teams that want managed`,
    ],
    apiIntegrationDetails: `REST API: every flow is exposed at 'GET /api/v1/prediction/{flowId}'. Auth via API key header. Self-hosted via Docker; managed via Flowise Cloud.`,
    modalities: ["agents", "tools", "chat"],
  },""",
    },
    # ── Mindsdb ────────────────────────────────────────────────────────────
    {
        "name": "mindsdb",
        "block": """  {
    name: `mindsdb`,
    displayName: `Mindsdb`,
    tagline: `Platform that automates pipelines connecting real-time enterprise data to AI systems — train, deploy, and observe ML models with SQL.`,
    icon: `Database`,
    color: `#00b06d`,
    category: `specialized`,
    kind: `platform`,
    popularity: `medium`,
    bestFor: [
      `Bringing ML/AI to business analysts who know SQL but not Python`,
      `Training and deploying models on top of real-time data warehouses`,
      `Time-series forecasting, classification, and regression at scale`,
      `Connecting LLMs to enterprise data without building a RAG pipeline`,
      `Automated ML pipelines with trigger events and observability`,
    ],
    capabilities: [
      `CREATE ML_MODEL with SQL — train models from inside your database`,
      `Join LLMs (OpenAI, Anthropic, HuggingFace) to your tables with a single query`,
      `Run time-series forecasting, classification, and regression`,
      `Define trigger events that fire when data drift is detected`,
      `Connect to 200+ data sources (Postgres, MySQL, Snowflake, BigQuery, Kafka)`,
    ],
    whenToUse: [
      `Your data lives in a warehouse and you want ML without ETL to Python`,
      `Your team is SQL-fluent but not Python-fluent`,
      `You need time-series forecasting on live data`,
      `You want to bring LLMs to your enterprise data without a RAG stack`,
    ],
    limitations: [
      `Less flexible than raw Python for custom architectures`,
      `Best-fit for tabular / time-series — not for image/video workflows`,
      `Cloud pricing can compound on high-volume forecasting jobs`,
      `Self-hosted setup requires Docker and a database connection`,
    ],
    samplePrompts: [
      `Write a Mindsdb SQL query to train a time-series forecaster on a Postgres sales table.`,
      `Show me how to join OpenAI GPT-4 to a MySQL customer-feedback table with a single CREATE MODEL statement.`,
      `Build a Mindsdb trigger that fires a Slack alert when churn predictions drop below 0.7.`,
    ],
    setupNotes: `pip install mindsdb. Or use Docker: 'docker run -p 47334:47334 mindsdb/mindsdb'. Cloud option at mindsdb.com. Connect to your data warehouse via the Mindsdb SQL UI.`,
    pricingTier: `Free open-source (GPL v3). Mindsdb Cloud: free dev tier, paid plans for production from ~$100/mo.`,
    docsUrl: `https://docs.mindsdb.com/`,
    availableModels: [
      `OpenAI GPT-4o`,
      `Anthropic Claude`,
      `HuggingFace (any model)`,
      `Lightwood (auto-ML)`,
      `Prophet (time-series)`,
      `custom`,
    ],
    availableAgents: [
      `business_analyst`,
      `research`,
    ],
    advantages: [
      `SQL-native — no Python required for ML`,
      `200+ data source connectors`,
      `Auto-ML via Lightwood for tabular and time-series`,
      `LLM-to-database joins in a single query`,
      `Trigger events and observability built-in`,
    ],
    businessAdvantages: [
      `Brings ML to SQL-fluent analysts without Python upskilling`,
      `Eliminates ETL — models run where the data lives`,
      `Open-source with a managed cloud option`,
      `Reduces time-to-deploy for forecasting and classification`,
    ],
    apiIntegrationDetails: `SQL API: 'CREATE MODEL mindsb.forecaster FROM my_db (SELECT * FROM sales) PREDICT revenue ORDER BY date HORIZON 7;'. REST API for predictions: 'POST /api/projects/{project}/models/{model}/predict'.`,
    modalities: ["tools", "embeddings"],
  },""",
    },
    # ── MLC LLM ────────────────────────────────────────────────────────────
    {
        "name": "mlc-llm",
        "block": """  {
    name: `mlc-llm`,
    displayName: `MLC LLM`,
    tagline: `Machine Learning Compilation for LLMs — deploy any large language model natively on any device with compiler acceleration.`,
    icon: `Cpu`,
    color: `#7c3aed`,
    category: `local`,
    kind: `framework`,
    popularity: `medium`,
    bestFor: [
      `Deploying LLMs natively on iOS, Android, web browsers, and edge devices`,
      `Compiler-accelerated inference without runtime overhead`,
      `Running Llama, Mistral, Phi, Gemma on consumer GPUs and Apple Silicon`,
      `WebGPU-based in-browser LLM inference`,
      `Quantized (q3f16, q4f16) deployment for low-memory devices`,
    ],
    capabilities: [
      `Compile any Llama-family model to run natively on iPhone / Android`,
      `Run LLMs in the browser via WebGPU (mlc-web)`,
      `Deploy on Apple Silicon with Metal acceleration`,
      `Quantize to q3f16 / q4f16 for sub-4GB VRAM deployment`,
      `Serve via Python, REST API, or native iOS/Android Swift/Kotlin`,
    ],
    whenToUse: [
      `You need on-device LLM inference on iOS / Android`,
      `You want browser-based LLM inference via WebGPU`,
      `You're targeting Apple Silicon with Metal acceleration`,
      `You need quantized deployment on consumer GPUs (sub-8GB VRAM)`,
    ],
    limitations: [
      `Compilation step is non-trivial — requires CUDA / Metal toolchain`,
      `Smaller model library than llama.cpp / Ollama`,
      `Best for Llama-family; non-Llama architectures need custom compile`,
      `Browser WebGPU support is still inconsistent across browsers`,
    ],
    samplePrompts: [
      `Show me how to compile Llama-3-8B for iPhone deployment with q4f16 quantization.`,
      `Write the MLC LLM config to run Mistral-7B in a browser via WebGPU.`,
      `Compare MLC LLM vs llama.cpp vs Ollama for on-device LLM inference on Apple Silicon.`,
    ],
    setupNotes: `pip install mlc-llm mlc-ai-nightly. Compile a model: 'mlc_llm compile model_config.json --device iphone'. For browser: use the mlc-web npm package. Requires CUDA toolkit (Linux) or Xcode (iOS) or Android NDK.`,
    pricingTier: `Free open-source (Apache 2.0).`,
    docsUrl: `https://llm.mlc.ai/`,
    availableModels: [
      `Llama-2/3`,
      `Mistral / Mixtral`,
      `Phi-2/3`,
      `Gemma`,
      `Qwen`,
      `RedPajama`,
    ],
    availableAgents: [
      `fullstack_dev`,
      `research`,
    ],
    advantages: [
      `Native deployment on iOS, Android, browser, and edge devices`,
      `Compiler acceleration — no runtime interpreter overhead`,
      `WebGPU support for in-browser LLM inference`,
      `Apple Silicon Metal acceleration`,
      `Aggressive quantization (q3f16) for sub-4GB deployment`,
    ],
    businessAdvantages: [
      `Apache 2.0 — fully commercial`,
      `Enables on-device AI for privacy-sensitive industries (health, finance)`,
      `No cloud inference costs — runs on user hardware`,
      `Backed by Carnegie Mellon researchers and Apache TVM community`,
    ],
    apiIntegrationDetails: `Python API: 'from mlc_llm import MLCEngine; engine = MLCEngine("Llama-3-8B"); engine.chat.completions.create(messages=[...])'. REST API: 'mlc_llm serve Llama-3-8B --port 8000'. Native iOS/Android via Swift/Kotlin SDK.`,
    modalities: ["chat", "code"],
  },""",
    },
    # ── Unity ML Agents Toolkit ───────────────────────────────────────────
    {
        "name": "unity-ml-agents",
        "block": """  {
    name: `unity-ml-agents`,
    displayName: `Unity ML Agents Toolkit`,
    tagline: `Enables games and simulations as environments for training intelligent agents — PyTorch-based RL for 2D, 3D, and VR/AR games.`,
    icon: `Bot`,
    color: `#1ec6f5`,
    category: `specialized`,
    kind: `framework`,
    popularity: `medium`,
    bestFor: [
      `Training RL agents in Unity game environments`,
      `Controlling NPC behavior in games via learned policies`,
      `Automated testing of game builds with AI agents`,
      `Evaluating game-design decisions pre-release via simulated play`,
      `Multi-agent and adversarial RL research in 3D`,
    ],
    capabilities: [
      `Train agents with PPO, SAC, and POCA in Unity 2D/3D/VR environments`,
      `Export trained policies as ONNX for inference inside Unity`,
      `Run multi-agent and adversarial training scenarios`,
      `Use Curiosity-driven exploration for sparse-reward environments`,
      `Integrate with Python training loop via the side-channel API`,
    ],
    whenToUse: [
      `You're building a game in Unity and want learned NPC behavior`,
      `You need a 3D environment for RL research (richer than Gymnasium)`,
      `You want to automate playtesting with AI agents`,
      `You're training robots or autonomous agents in simulation`,
    ],
    limitations: [
      `Requires Unity Editor — Windows/macOS/Linux only (no headless server by default)`,
      `Training is slower than 2D RL benchmarks (Gymnasium) due to 3D rendering`,
      `Best for game devs; pure RL researchers may prefer Isaac Gym / Brax`,
      `ONNX inference in Unity is experimental for very large models`,
    ],
    samplePrompts: [
      `Write a Unity ML Agents PPO config for training a navigation agent in a 3D maze.`,
      `Show me how to export a trained Unity ML Agents policy as ONNX for runtime inference.`,
      `Design a multi-agent adversarial training scenario for a 2-player game.`,
    ],
    setupNotes: `Install Unity 2022.3+. In Unity Package Manager, add the 'com.unity.ml-agents' package. Python side: 'pip install mlagents'. Launch training: 'mlagents-learn config/ppo.yaml --run-id=run1'.`,
    pricingTier: `Free open-source (Apache 2.0). Unity Editor free for personal use; Pro license for commercial games over revenue threshold.`,
    docsUrl: `https://unity-technologies.github.io/ml-agents/`,
    availableModels: [
      `PPO`,
      `SAC`,
      `POCA`,
      `custom (any PyTorch policy)`,
    ],
    availableAgents: [
      `devops`,
      `research`,
    ],
    advantages: [
      `Rich 3D environments — far more realistic than 2D RL benchmarks`,
      `Multi-agent and adversarial training out of the box`,
      `Curiosity-driven exploration for sparse rewards`,
      `ONNX export for runtime inference inside Unity`,
      `Side-channel API for custom Python↔Unity communication`,
    ],
    businessAdvantages: [
      `Apache 2.0 toolkit — commercial use allowed`,
      `Enables learned NPC behavior without hand-written behavior trees`,
      `Automates playtesting — catch design flaws before launch`,
      `Active community backed by Unity Technologies`,
    ],
    apiIntegrationDetails: `Python API: 'pip install mlagents; mlagents-learn config/ppo.yaml'. Unity side: add Behavior Parameters component to agent GameObject. Inference: import ONNX model via Unity Inference Engine.`,
    modalities: ["agents", "code"],
  },""",
    },
]


# ── Idempotent insertion ─────────────────────────────────────────────────
def main() -> int:
    if not FILE.exists():
        print(f"ERROR: {FILE} not found", file=sys.stderr)
        return 1

    txt = FILE.read_text()

    # Find the closing `];` of PROVIDER_BENEFITS array (the first `];` after
    # the `export const PROVIDER_BENEFITS:` line).
    m = re.search(r'export const PROVIDER_BENEFITS[^=]*=\s*\[', txt)
    if not m:
        print("ERROR: could not find PROVIDER_BENEFITS array start", file=sys.stderr)
        return 1
    start = m.end()

    # Find matching closing `];` — naive: next `];` at the top level.
    # The array is the first top-level `];` after start.
    end = txt.find("\n];", start)
    if end < 0:
        print("ERROR: could not find closing `];` of PROVIDER_BENEFITS", file=sys.stderr)
        return 1

    inserted = 0
    skipped = 0
    new_txt = txt

    for entry in ENTRIES:
        name = entry["name"]
        # Check if name already present in the file (as `name: \`<name>\`,`)
        if re.search(r'name:\s*`' + re.escape(name) + r'`\s*,', new_txt):
            print(f"  SKIP  {name:25s} — already present")
            skipped += 1
            continue

        # Insert before the closing `];`.
        # Re-find end because positions shift after each insert.
        end = new_txt.find("\n];", start)
        if end < 0:
            print(f"ERROR: lost closing ];; while inserting {name}", file=sys.stderr)
            return 1

        block = entry["block"].rstrip() + "\n"
        new_txt = new_txt[:end] + "\n" + block + new_txt[end:]
        print(f"  ADD   {name:25s} — inserted")
        inserted += 1

    if inserted == 0:
        print("No new entries to insert — all already present.")
        return 0

    FILE.write_text(new_txt)
    print(f"\nDone. Inserted {inserted} new entr{'y' if inserted == 1 else 'ies'}, skipped {skipped} existing.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
