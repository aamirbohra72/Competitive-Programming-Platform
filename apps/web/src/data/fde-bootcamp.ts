export interface FdeLesson {
  id: string;
  title: string;
  minutes: number;
  overview: string;
  notes: string[];
  assignment: { title: string; tasks: string[] };
}

export interface FdeModule {
  id: string;
  title: string;
  weeks: number;
  description: string;
  lessons: FdeLesson[];
}

function lesson(id: string, title: string, overview: string, notes: string[], assignment: string, tasks: string[], minutes = 60): FdeLesson {
  return { id, title, minutes, overview, notes, assignment: { title: assignment, tasks } };
}

export const FDE_COURSE_ID = 'fde-bootcamp';
export const FDE_COURSE_TITLE = 'FDE Bootcamp';
export const FDE_MODULES: FdeModule[] = [
  {
    id: 'foundations', title: 'Python & Linux Foundations', weeks: 1,
    description: 'Build a dependable programming baseline for enterprise engineering.',
    lessons: [
      lesson('python-core', 'Python: data, objects & exceptions', 'Translate business records into explicit, testable Python models.', [
        'Choose collections by access pattern: dictionaries for keyed lookups, sets for uniqueness, and lists for ordered records. Aliasing means two variables can refer to the same mutable object; copy deliberately when transforming shared input.',
        'Separate domain objects from input/output. Validate fields at the boundary, raise specific exceptions for invalid records, and use context managers for files. Catch exceptions only where you can recover or add useful context.',
        'A reliable import pipeline reports rejected rows without hiding failures. Test empty inputs, malformed records, duplicate keys, and partial reads before measuring performance.',
      ], 'Build a validated customer import', ['Model a customer record and parse a small CSV fixture.', 'Reject duplicate IDs and invalid fields with actionable errors.', 'Add tests for empty, malformed, and valid inputs.']),
      lesson('python-async', 'Async Python & concurrency', 'Keep network-heavy workloads responsive without blocking the event loop.', [
        'A coroutine cooperatively yields at await points. Blocking file or CPU work still blocks the event loop unless moved to a suitable executor. Threads suit blocking I/O; CPU-heavy work often needs separate processes.',
        'Bound concurrency with a semaphore instead of creating unlimited tasks. Attach timeouts to external calls, propagate cancellation, and close connections when a task exits.',
        'Compare sequential and concurrent execution using repeatable fixtures. A faster happy path is not enough: test one slow dependency, a failing task, and cancellation during shutdown.',
      ], 'Write a bounded async collector', ['Fetch simulated endpoint records with a concurrency limit.', 'Implement timeout and cancellation behavior.', 'Compare sequential and concurrent runtimes and explain the trade-off.']),
      lesson('linux', 'Linux for engineers', 'Diagnose application behavior using processes, permissions, and environment configuration.', [
        'Linux access depends on file ownership and read, write, and execute bits. Grant only the permissions an application needs; avoid running services as root simply to bypass a permission error.',
        'Use process and network inspection to separate a dead service from a routing or permission problem. Environment variables are process-local configuration; credentials should not appear in shell history or logs.',
        'A useful operational script checks prerequisites, exits nonzero on failure, and avoids silently changing system state. Make it safe to rerun and document its assumptions.',
      ], 'Create a service diagnostic runbook', ['Write checks for disk space, process health, and a listening port.', 'Demonstrate least-privilege file permissions in a local sandbox.', 'Document a reproducible startup failure and its diagnosis.']),
    ],
  },
  {
    id: 'api-development', title: 'Modern API Development', weeks: 1,
    description: 'Expose application logic through validated APIs and disciplined tests.',
    lessons: [
      lesson('fastapi', 'FastAPI & REST APIs', 'Define stable request and response contracts around domain behavior.', [
        'Pydantic models validate untrusted request data and make response contracts explicit. Keep persistence and domain decisions outside route handlers so the same behavior can be tested without an HTTP server.',
        'Use dependency injection for authentication, configuration, and database access. Distinguish validation errors, missing resources, and unavailable dependencies with meaningful HTTP statuses; never return internal secrets in errors.',
        'Pagination, input size limits, and consistent error shapes are part of the API contract. CORS controls browser access, not authentication or authorization.',
      ], 'Build an inventory API', ['Implement validated create, list, and update operations.', 'Add pagination and consistent error responses.', 'Test invalid input and missing resources.']),
      lesson('graphql', 'GraphQL & API versioning', 'Choose a query interface without sacrificing predictable resource usage.', [
        'GraphQL exposes typed fields and resolvers; queries read data while mutations change state. A resolver per item can cause an N+1 query pattern, so batch related lookups and measure database calls.',
        'Limit query complexity and depth, authorize fields, and avoid exposing internal schema details. Flexible selection does not mean unlimited work or unrestricted access.',
        'Version a breaking REST contract intentionally through URL or header strategies. For GraphQL, deprecate fields and observe usage before removing them; maintain compatibility tests during transitions.',
      ], 'Design a compatible query layer', ['Define a product query and a mutation schema.', 'Show how batched fetching avoids N+1 queries.', 'Write a migration plan for a renamed response field.']),
      lesson('pytest', 'Pytest & debugging workflows', 'Turn failures into small, reproducible checks.', [
        'Fixtures should isolate state and make dependencies explicit. Mock the unstable boundary, not the behavior being tested, and include at least one integration check for important database contracts.',
        'Use breakpoints to inspect the controlling values and call stack before changing code. A failing assertion is more useful than a broad logging dump when you can reproduce the problem locally.',
        'Coverage measures executed lines, not correctness. Add behavioral cases for retries, validation failures, and authorization boundaries, then ensure the normal test command actually runs them.',
      ], 'Build an API regression suite', ['Add isolated fixtures and dependency overrides.', 'Test success, validation failure, and authorization denial.', 'Record a debugging walkthrough for one failing test.']),
    ],
  },
  {
    id: 'cloud-networking', title: 'Cloud Fundamentals & Networking', weeks: 2,
    description: 'Plan secure AWS infrastructure with clear network and cost boundaries.',
    lessons: [
      lesson('aws', 'AWS compute, storage & managed data', 'Select services by workload rather than by familiarity.', [
        'Virtual machines provide control over a persistent host; managed serverless compute reduces host operations but introduces runtime limits. Object storage fits blobs, while relational databases fit transactional records and indexed queries.',
        'Storage lifecycle rules, backups, and restore tests must match business retention requirements. Encryption does not replace access controls, and a backup is only useful if recovery has been exercised.',
        'Start with a workload estimate: request volume, data size, latency target, and acceptable downtime. Use that estimate to justify a small architecture before adding distributed components.',
      ], 'Propose a document-processing stack', ['Map compute, object storage, and relational metadata services.', 'Define backup, retention, and restore requirements.', 'Estimate cost drivers and record sizing assumptions.']),
      lesson('networking', 'VPCs, subnets & security groups', 'Make connectivity explicit between application components.', [
        'A subnet is public when its routing permits internet-gateway access; placing a workload there does not automatically make it safely reachable. Private workloads may use controlled outbound NAT without accepting inbound internet traffic.',
        'Security groups restrict traffic at the resource boundary. Permit only necessary source, destination, and port combinations; keep databases private and avoid broad inbound rules for convenience.',
        'Debug connectivity in layers: name resolution, route, network policy, listener, and application response. Record which layer failed instead of repeatedly widening firewall permissions.',
      ], 'Draw and validate a network boundary', ['Design public ingress and private application/database subnets.', 'Specify minimal traffic rules between tiers.', 'Write a layered connectivity troubleshooting checklist.']),
      lesson('iam-budgets', 'IAM, least privilege & cloud budgets', 'Control who can act and how much infrastructure can cost.', [
        'IAM policies describe allowed actions on resources, and explicit deny takes precedence. Prefer temporary role credentials over static access keys; cross-account access requires both an appropriate trust policy and permissions.',
        'A budget alert is a notification, not a guaranteed spending cap. Combine alerts with service quotas, resource cleanup, and workload-level usage controls.',
        'Review access and cost after the pilot expands. Record an owner for every resource, tag environments consistently, and test that unnecessary actions are denied.',
      ], 'Create a least-privilege deployment plan', ['Specify a role for one bounded deployment workflow.', 'List allowed and denied operations and test scenarios.', 'Set budget thresholds and a teardown checklist without provisioning paid resources.']),
    ],
  },
  {
    id: 'containers', title: 'Containerization & CI/CD', weeks: 1,
    description: 'Package, deploy, and release an application consistently.',
    lessons: [
      lesson('docker', 'Docker & Docker Compose', 'Build repeatable application environments with minimal privileges.', [
        'A container packages a process and its dependencies, not a full virtual machine. Keep images small with layered builds, pin dependencies, and exclude secrets and development artifacts from the build context.',
        'Run as a non-root user and expose only necessary ports. Compose networks provide service discovery for local dependencies; named volumes persist data beyond an individual container lifecycle.',
        'Health checks should reflect meaningful readiness. Test clean startup, dependency failure, shutdown, and a rebuild from the documented configuration.',
      ], 'Containerize the inventory API', ['Create a minimal non-root Docker image.', 'Define local API/database services and persistent storage.', 'Document health checks, shutdown, and secret handling.']),
      lesson('fargate', 'App Runner & ECS Fargate', 'Move containers into managed infrastructure with explicit operational limits.', [
        'App Runner simplifies an application service; ECS Fargate gives more control over task, network, and scaling configuration. Choose based on requirements for connectivity, deployment behavior, and operational ownership.',
        'Task CPU, memory, health checks, and IAM roles affect both availability and cost. Keep a task role for application permissions separate from the execution role used to pull images and write logs.',
        'An autoscaling rule should use a measured signal and sensible minimum and maximum capacity. Test a rolling release and define rollback conditions before sending production traffic.',
      ], 'Write a managed-container deployment spec', ['Compare App Runner and Fargate for the API workload.', 'Define task resources, roles, health checks, and ingress.', 'Specify scaling and rollback criteria.']),
      lesson('github-actions', 'CI/CD with GitHub Actions', 'Make verification a required step before deployment.', [
        'A delivery pipeline should reproduce installation, testing, and artifact creation from a clean checkout. Use a lockfile and treat failed verification as a release blocker rather than a warning.',
        'Use narrowly scoped credentials or federated identity, and avoid exposing secrets to untrusted pull requests. Promote the same immutable artifact across environments instead of rebuilding different binaries.',
        'Separate deployment approval from code compilation when risk warrants it. Record the artifact identifier and release outcome so a rollback points to a known good version.',
      ], 'Author a release workflow', ['Define install, lint, test, and image-build stages.', 'Describe secure deployment identity and environment approval.', 'Write a rollback procedure using an immutable image tag.']),
    ],
  },
  {
    id: 'llm-fundamentals', title: 'LLM Fundamentals & Prompting', weeks: 1,
    description: 'Build bounded, validated interactions with language models.',
    lessons: [
      lesson('prompting', 'Prompt engineering & context management', 'Design clear instructions with explicit evidence and output boundaries.', [
        'Separate trusted instructions from untrusted documents and user inputs. State the task, allowed evidence, output format, and uncertainty behavior; examples can clarify a contract without guaranteeing that the model follows it.',
        'A context window is finite. Budget space for instructions, retrieved evidence, conversation, and output, then trim or summarize deliberately without dropping critical source attribution.',
        'Evaluate observable answers and concise justifications rather than depending on hidden model reasoning. Compare prompts on a stable set of cases including ambiguous, irrelevant, and adversarial input.',
      ], 'Build a prompt evaluation sheet', ['Create a document-answering prompt with source boundaries.', 'Define a context budget and truncation strategy.', 'Evaluate five cases including insufficient evidence.']),
      lesson('structured-output', 'Structured outputs & Pydantic validation', 'Treat model output as untrusted data, even when it resembles JSON.', [
        'JSON syntax validity is different from domain validity. A schema should constrain required fields, ranges, enums, and nested objects; validate relationships and business rules after parsing.',
        'Discriminated unions make alternative response types explicit. Reject unexpected variants, attach bounded retries to malformed output, and return a clear failure when validation cannot be satisfied.',
        'Do not execute model-generated code or commands as part of parsing. Store only necessary validated fields and test responses with missing keys, wrong types, and extra content.',
      ], 'Validate an extraction contract', ['Define an invoice model with typed line items.', 'Validate malformed, incomplete, and correct fixtures.', 'Implement a bounded retry/failure policy.']),
      lesson('tool-calling', 'Tool calling & function contracts', 'Allow models to request actions without granting them unrestricted execution.', [
        'A tool schema describes an allowed operation, but the server must validate arguments and authorize the current user independently. Never let the model select arbitrary filesystem paths, database commands, or credentials.',
        'Distinguish read-only tools from side-effecting actions. Add approval, idempotency, and audit records to consequential operations; parallelize only calls whose effects are independent.',
        'Include tool results as data, not new trusted instructions. Handle unknown tool names and rejected arguments without allowing the model to bypass the policy boundary.',
      ], 'Implement a safe ticket tool contract', ['Define a bounded ticket-creation schema.', 'Add validation, authorization, and an idempotency strategy.', 'Test an unknown tool and malicious argument fixtures.']),
    ],
  },
  {
    id: 'vector-rag', title: 'Vector Search & Core RAG', weeks: 2,
    description: 'Retrieve useful evidence and measure answer quality.',
    lessons: [
      lesson('chunking', 'Chunking & embedding models', 'Preserve document meaning when converting content into searchable units.', [
        'Fixed-size chunks are easy to implement but can split tables or explanations. Semantic boundaries preserve topic context; overlap may recover continuity at the cost of duplicate evidence and larger indexes.',
        'Embeddings encode similarities in a model-specific vector space. Keep query and document embeddings compatible, and retain source ID, version, location, and permissions as metadata.',
        'Compare chunking strategies on actual retrieval questions. Measure missed evidence and duplication, not just whether vector creation succeeds.',
      ], 'Design a chunking experiment', ['Chunk a synthetic policy document in two ways.', 'Preserve source locations and access metadata.', 'Compare retrieved evidence for five queries.']),
      lesson('vector-databases', 'Pinecone, Qdrant & vector indexes', 'Select and query a vector index with realistic constraints.', [
        'Distance metrics and vector dimensions must match the embedding setup. Approximate nearest-neighbor indexing trades exactness for speed; evaluate its recall before assuming the nearest result is relevant.',
        'Apply tenant and permission filters during retrieval rather than filtering an unauthorized answer afterward. Plan index updates and document deletion so stale or revoked data cannot remain searchable.',
        'Benchmark latency, recall, and cost under representative filters. A demonstration with a handful of unfiltered vectors does not validate production performance.',
      ], 'Define a permission-aware search index', ['Choose an embedding/index configuration and justify it.', 'Specify tenant, source-version, and permission filters.', 'Test update and deletion behavior using fixtures.']),
      lesson('hybrid-search', 'Vanilla RAG & hybrid search', 'Combine complementary retrieval signals instead of relying on one score.', [
        'A RAG flow retrieves evidence, assembles a prompt, and generates an answer with references. Retrieval failures and generation failures are separate problems and should have separate evaluation checks.',
        'Dense search finds semantic similarity while sparse methods such as BM25 preserve keyword signals. Reciprocal rank fusion combines ranked lists using reciprocal positions rather than mixing incomparable raw scores.',
        'Deduplicate results, preserve attribution, and answer with uncertainty when supporting evidence is absent. Adding more irrelevant context can reduce answer quality.',
      ], 'Compare dense and hybrid retrieval', ['Create keyword and semantic result lists for the same queries.', 'Implement or specify reciprocal rank fusion with a documented constant.', 'Compare evidence coverage and source citations.']),
      lesson('reranking', 'Retrieval evaluation & reranking', 'Use measurable relevance rather than visually convincing answers.', [
        'Precision measures the fraction of retrieved results that are relevant; recall measures how much relevant evidence was recovered. Label a representative dataset before tuning retrieval parameters.',
        'A cross-encoder reranker jointly scores a query and candidate passage, improving relevance at added latency and cost. Retrieve a bounded candidate set and rerank only what the workload can afford.',
        'Keep a held-out query set and report latency alongside quality. Repeatedly tuning on the same examples can hide regressions for unfamiliar customer requests.',
      ], 'Produce a retrieval benchmark', ['Label relevant passages for a small query dataset.', 'Compare top-k precision/recall before and after reranking.', 'Report latency and explain one failed retrieval case.']),
    ],
  },
  {
    id: 'knowledge-graphs', title: 'Enterprise Graph Architecture', weeks: 1,
    description: 'Model interconnected enterprise information and query it safely.',
    lessons: [
      lesson('graph-modeling', 'Knowledge graphs & data modeling', 'Make relationships first-class without losing the source of truth.', [
        'Nodes represent entities, relationships connect them, and properties describe both. Define stable identifiers and relationship meaning before importing data so duplicate names do not silently merge unrelated entities.',
        'An ontology defines domain concepts and constraints; a taxonomy is a hierarchy of categories. Choose the minimum useful model and preserve source provenance on imported records.',
        'A graph is valuable when the questions depend on connected paths. Test the model against concrete business queries instead of translating every relational table mechanically.',
      ], 'Model an enterprise supplier graph', ['Define entities, relationship types, and stable identifiers.', 'Map a small relational fixture into graph records.', 'Write three relationship-driven business questions.']),
      lesson('cypher', 'Neo4j & Cypher', 'Express bounded graph traversal and verify the returned paths.', [
        'Cypher patterns describe nodes and relationships to match. Parameterize user values, constrain traversal depth, and inspect the result shape rather than accepting an arbitrary model-generated query.',
        'Indexes and uniqueness constraints improve lookup and protect data quality. Large unbounded traversals can cause expensive work even when the query is syntactically valid.',
        'Use explain/profile tooling on representative queries. Test absent nodes, cycles, and duplicate import attempts before integrating the graph into an AI workflow.',
      ], 'Write bounded graph queries', ['Author parameterized supplier and dependency queries.', 'Add identity constraints and lookup indexes.', 'Test cyclic paths and missing entities.']),
      lesson('graph-integration', 'Enterprise graph integrations', 'Combine graph evidence with other retrieval layers responsibly.', [
        'Graph retrieval can answer relationship questions while vector retrieval finds document passages. Preserve the distinction between a known graph fact and an inferred statement from a language model.',
        'Neo4j and managed graph services such as Neptune differ in query languages, operational characteristics, and ecosystem support. Evaluate the specific service/version against the required query and hosting model.',
        'Carry identity and tenant boundaries into graph queries. Provenance, synchronization, and deletion policies matter as much as the initial data import.',
      ], 'Design graph-assisted evidence retrieval', ['Route relationship and document questions to suitable stores.', 'Specify synchronization and access-control rules.', 'Create an answer example with traceable graph and document evidence.']),
    ],
  },
  {
    id: 'multimodal', title: 'Multimodal RAG & Vision AI', weeks: 1,
    description: 'Retrieve and reason over documents that include tables, scans, and images.',
    lessons: [
      lesson('document-parsing', 'Document parsing & ColPali', 'Choose extraction strategies based on the document, not a single parser.', [
        'Native text extraction preserves selectable text; OCR recognizes text in image scans; visual retrieval can retain layout relationships that text-only extraction loses. Each approach has different accuracy, compute, and privacy requirements.',
        'ColPali-style late-interaction representations support page-level visual retrieval. Preserve the original page and location when indexing results rather than treating an embedding as a complete document.',
        'Evaluate extraction on multi-column layouts, rotated scans, and dense tables. Record unsupported cases and route them to review instead of silently returning incomplete content.',
      ], 'Build a document ingestion decision tree', ['Compare native extraction, OCR, and visual retrieval for sample types.', 'Preserve document/page provenance.', 'Define review triggers for unreadable or ambiguous pages.']),
      lesson('vision-models', 'Vision-language models & visual embeddings', 'Use visual evidence with bounded claims and explicit uncertainty.', [
        'Vision-language models connect image features to language tasks. CLIP-style embeddings support cross-modal similarity, but similarity does not establish identity, factual correctness, or precise numerical extraction.',
        'Control image size and preserve details relevant to the task. Never treat text visible inside an image as trusted instructions; apply the same prompt-injection boundaries used for retrieved documents.',
        'Evaluate task-specific correctness and abstention. A model can sound certain about a blurry chart, so require evidence checks rather than relying on verbal confidence alone.',
      ], 'Evaluate a visual evidence workflow', ['Define an image-question contract with uncertainty handling.', 'Compare relevant and irrelevant image retrieval examples.', 'Document privacy controls and visual failure cases.']),
      lesson('tables-charts', 'Scanned PDFs, tables & charts', 'Preserve structure and units when interpreting enterprise reports.', [
        'Tables require relationships between row labels, column headings, and values. Keep units, totals, footnotes, and merged cells together; flattening the page into text may lose these relationships.',
        'Chart interpretation must identify axes, scales, legend, time period, and source. Do not infer an exact value from an ambiguous visual estimate without checking the underlying data.',
        'For multi-page reports, cite the exact page and relevant region. Validate extracted totals and reconcile contradictions before producing a decision-oriented summary.',
      ], 'Audit a synthetic financial report', ['Extract one table with units and page references.', 'Write a chart interpretation with uncertainty bounds.', 'Reconcile totals and identify an intentionally inconsistent figure.']),
    ],
  },
  {
    id: 'agent-frameworks', title: 'Agentic Frameworks & LangGraph', weeks: 1,
    description: 'Build explicit agent workflows with controlled state and execution.',
    lessons: [
      lesson('agent-patterns', 'Agentic fundamentals & design patterns', 'Choose the simplest workflow that can meet the task.', [
        'An agent chooses actions from observations, while a deterministic pipeline follows an explicit route. ReAct-style loops alternate tool use and observation; plan-and-execute separates planning from execution but still needs validation.',
        'A router delegates by task type, while a supervisor coordinates multiple workers. More agents do not automatically improve results; added calls increase cost and create more failure boundaries.',
        'Limit steps, tools, and time budgets. Test termination and escalation behavior, especially when the model repeatedly chooses an unhelpful action.',
      ], 'Compare workflow architectures', ['Map a support triage task to pipeline, router, and supervisor designs.', 'Define allowed tools and step budgets.', 'Describe termination and human escalation rules.']),
      lesson('langgraph', 'LangGraph state, nodes & routing', 'Make workflow transitions observable and reproducible.', [
        'A graph defines state, nodes, and edges; conditional routing selects the next step from validated state. Keep state fields typed and define clear ownership for updates.',
        'Nodes should perform bounded work and return explicit changes. Keep irreversible side effects behind authorization and idempotency checks rather than hiding them inside reasoning steps.',
        'Test transitions with deterministic fixtures before connecting a model. Trace the route taken for success, rejection, and dependency failure.',
      ], 'Build a triage graph specification', ['Define state and node contracts for classify, retrieve, and respond.', 'Add conditional routes for missing evidence and failure.', 'Create deterministic transition tests.']),
      lesson('parallel-agents', 'Parallel execution & subgraphs', 'Parallelize independent work while resolving state updates safely.', [
        'Independent tasks can run concurrently, but shared state needs explicit merge rules. Reducers should define how results combine rather than relying on completion order.',
        'Subgraphs isolate a bounded workflow inside a larger graph. Specify input/output contracts, cancellation behavior, and failure propagation at the parent-child boundary.',
        'Map-reduce patterns work well when each worker produces comparable evidence. Test partial failure and preserve source attribution when aggregating results.',
      ], 'Design a parallel evidence collector', ['Split independent policy lookups into workers.', 'Define deterministic merge and conflict handling.', 'Test timeout, cancellation, and one failed worker.']),
    ],
  },
  {
    id: 'agent-orchestration', title: 'Advanced Agent Orchestration', weeks: 1,
    description: 'Add durable execution, human approval, and safe tool access.',
    lessons: [
      lesson('memory-hitl', 'Memory & human-in-the-loop workflows', 'Persist useful context without giving agents uncontrolled long-term memory.', [
        'A checkpoint records execution state for recovery; semantic memory retrieves relevant prior information. Neither should store unnecessary personal data or grant access beyond the current user and tenant.',
        'Human approval should display the exact proposed action, its evidence, and its consequences. An approval token should authorize only that action and expire when the proposal changes.',
        'Resume interrupted workflows idempotently. Test rejection, stale approval, replay, and recovery after a process restart.',
      ], 'Specify an approval checkpoint', ['Define the proposed action and evidence shown to a reviewer.', 'Bind approval to a specific action/version.', 'Test reject, resume, and replay scenarios.']),
      lesson('agent-recovery', 'Error handling & Bedrock AgentCore', 'Bound agent recovery loops and clarify managed-service responsibilities.', [
        'Classify failures into invalid input, transient dependency failure, and policy rejection. Only transient failures usually justify bounded retries; an authorization denial should not be retried with altered permissions.',
        'Limit self-correction attempts and execution time. Managed agent services can simplify runtime operations, but tool permissions, data boundaries, and application behavior still require explicit design.',
        'Record the cause of recovery and the final outcome. Test unavailable tools, repeated invalid arguments, and exhausted retry budgets.',
      ], 'Create an agent recovery matrix', ['Classify representative failures and allowed responses.', 'Define retry, timeout, and loop limits.', 'Compare self-managed and managed runtime responsibilities.']),
      lesson('mcp', 'Model Context Protocol', 'Expose enterprise tools through narrow, auditable contracts.', [
        'MCP standardizes interactions between hosts, clients, and servers for tools and contextual resources. A standardized interface is not a security guarantee; authentication and per-operation authorization remain necessary.',
        'Publish small tool schemas with constrained arguments and minimal results. Treat tool output as untrusted data, and prevent credentials or privileged network access from leaking through responses.',
        'Document the trust boundary between an agent and each tool server. Test unauthorized requests, malicious tool output, and timeouts before enabling side effects.',
      ], 'Define a safe MCP ticket server', ['Specify a constrained read/create ticket tool interface.', 'Define identity propagation and authorization checks.', 'Write malicious-output and unauthorized-access test cases.']),
    ],
  },
  {
    id: 'legacy-integration', title: 'Legacy Systems & Integrations', weeks: 1,
    description: 'Connect modern workflows to corporate tools and older data systems.',
    lessons: [
      lesson('workspace-tools', 'Slack, Teams & Jira integrations', 'Translate workflow events into safe, traceable workspace actions.', [
        'Webhooks carry untrusted events. Verify authenticity using the provider-supported mechanism, validate payloads, and deduplicate deliveries before triggering downstream actions.',
        'Bot permissions should match the specific workspace task. Keep tokens server-side and distinguish user intent from automatically generated content when creating messages or tickets.',
        'Rate limits and duplicate delivery are normal operational conditions. Use idempotency, bounded retries, and audit identifiers to avoid repeated notifications or ticket creation.',
      ], 'Design an event-to-ticket integration', ['Validate and authenticate a synthetic webhook payload.', 'Define permission scopes and deduplication keys.', 'Test duplicate delivery and a provider rate limit.']),
      lesson('soap-xml', 'SOAP APIs & XML parsing', 'Adapt legacy contracts without trusting incoming XML.', [
        'A WSDL describes service operations, types, and message contracts. SOAP envelopes and faults differ from REST responses, so map them explicitly into a modern domain contract.',
        'Use maintained clients and secure parser settings that disable unsafe external entity resolution. Validate message sizes and expected fields before consuming a legacy response.',
        'Preserve distinctions between transport errors, SOAP faults, and domain failures. Test version mismatch, absent fields, and malformed XML using synthetic fixtures.',
      ], 'Create a legacy-service adapter', ['Map one SOAP operation into a typed JSON contract.', 'Define secure XML parsing and size limits.', 'Test a SOAP fault and malformed response.']),
      lesson('enterprise-sql', 'Oracle & Microsoft SQL Server', 'Query enterprise databases through constrained, least-privilege access.', [
        'Use maintained drivers and explicit connection lifecycle management. Parameterize values rather than concatenating SQL strings, and keep connection credentials outside model-visible context.',
        'A read-only role should restrict both operations and accessible data. Model-generated SQL must pass validation, table/column allowlists, row limits, and timeout controls before execution.',
        'Treat ambiguous natural-language questions as a reason to clarify, not a reason to widen access. Test cross-tenant queries, expensive joins, and unavailable database connections.',
      ], 'Specify a constrained SQL assistant', ['Define allowed tables, columns, and parameterized queries.', 'Add read-only permissions, row limits, and timeouts.', 'Test unauthorized and ambiguous requests.']),
    ],
  },
  {
    id: 'identity', title: 'Identity & Access Management', weeks: 1,
    description: 'Enforce identity and data-level permissions across the AI application.',
    lessons: [
      lesson('enterprise-sso', 'Enterprise SSO: OAuth, OIDC & SAML', 'Distinguish identity assertions from permission to access a resource.', [
        'OAuth delegates authorization; OIDC adds an identity layer; SAML exchanges signed assertions commonly used in enterprise SSO. Select a supported integration flow instead of manually inventing token formats.',
        'Validate token signatures, issuer, audience, expiration, and relevant claims using maintained libraries. A decoded JWT is not a verified JWT, and an ID token is not automatically an API access token.',
        'Account linking, logout, and session expiry are part of the integration. Test wrong-audience tokens, expired sessions, and users removed from the identity provider.',
      ], 'Document an enterprise SSO flow', ['Diagram browser, identity-provider, and API responsibilities.', 'List required validation checks for each credential type.', 'Test wrong audience, expiry, and account removal scenarios.']),
      lesson('rbac', 'Directory groups & data-level RBAC', 'Apply access policies before retrieving sensitive evidence.', [
        'Map directory groups into application roles with an explicit policy. Avoid granting access merely because a user supplies a role name or because the model claims a document is relevant.',
        'Apply tenant and data-level restrictions in retrieval, graph queries, and tools. Post-generation redaction cannot undo the fact that unauthorized evidence was already exposed to a model.',
        'Permissions can change during a session. Define cache invalidation and revocation behavior, and verify denial paths with a matrix of users, resources, and actions.',
      ], 'Build an authorization test matrix', ['Define reader, operator, and administrator permissions.', 'Apply tenant boundaries to search and SQL access.', 'Test revocation and cross-tenant data requests.']),
    ],
  },
  {
    id: 'ai-security', title: 'Production AI Security & Guardrails', weeks: 2,
    description: 'Protect data and complete the OmniGuard enterprise connector capstone.',
    lessons: [
      lesson('llm-security', 'OWASP LLM risks & prompt injection', 'Treat model behavior as one component of a wider security boundary.', [
        'Prompt injection can arrive through users, retrieved documents, images, or tool results. Separate instructions from data and assume the model may still follow hostile content despite defensive prompting.',
        'Enforce tool permissions, data access, and output validation outside the model. Guardrails reduce risk but cannot replace authorization or guarantee that every attack is blocked.',
        'Use harmless adversarial fixtures in an isolated test environment. Track attack success, false positives, and missed policy violations without exposing real credentials or private records.',
      ], 'Create a defensive threat model', ['Map untrusted inputs and sensitive actions.', 'Define non-model enforcement for each trust boundary.', 'Test synthetic injection attempts and legitimate requests.']),
      lesson('presidio', 'PII detection & masking with Presidio', 'Minimize personal data without assuming detectors are perfect.', [
        'PII recognizers identify candidate entities; anonymizers replace or transform them. Detection accuracy depends on language, context, and domain-specific formats, so validate against representative synthetic data.',
        'Reversible masking creates a sensitive lookup table. Restrict access to that table, isolate tenants, and avoid reintroducing hidden personal data into logs or untrusted tool output.',
        'Measure false positives and missed entities separately. Redaction is one privacy control alongside retention limits, access restrictions, and data minimization.',
      ], 'Evaluate a redaction pipeline', ['Create synthetic records with common and domain-specific PII.', 'Define masking and secure lookup-table handling.', 'Measure missed entities and incorrect redactions.']),
      lesson('guardrails', 'NeMo & Bedrock guardrails', 'Apply layered input and output policies with measurable trade-offs.', [
        'Conversational rails define permitted interaction paths, while content filters enforce selected policies. Keep business rules, tool permissions, and model-facing instructions separate so each can be tested independently.',
        'Apply checks at appropriate input, retrieval, tool, and output boundaries. A policy that blocks too much legitimate activity can be operationally harmful even when it appears secure.',
        'Version policies, retain redacted audit evidence, and test regressions before release. Include benign cases alongside adversarial fixtures to assess usability.',
      ], 'Design a layered guardrail policy', ['Define permitted scope and rejection behavior.', 'Place checks at input, tool, and output boundaries.', 'Evaluate adversarial and benign fixtures.']),
      lesson('omniguard', 'Capstone: OmniGuard Enterprise Connector', 'Deliver a permission-aware enterprise knowledge and SQL connector.', [
        'Begin with a discovery workshop: identify users, data classifications, permitted questions, and acceptance criteria. Turn these findings into an architecture statement of work rather than starting with a preferred model.',
        'Combine hybrid retrieval and constrained SQL with identity-aware access controls, PII protection, and guarded tools. Package the FastAPI application with a reproducible deployment and a rollback plan.',
        'Deliver an evidence-backed UAT runbook and executive summary. Report quality, security limitations, operating costs, and expected business value without claiming guaranteed ROI.',
      ], 'Deliver the OmniGuard project', ['Submit discovery notes, architecture, and permission matrix.', 'Build a tested hybrid-search/SQL prototype using synthetic data.', 'Produce a Docker deployment, UAT runbook, and executive ROI assumptions.'], 120),
    ],
  },
  {
    id: 'observability', title: 'AI Observability & Gateway Management', weeks: 2,
    description: 'Measure reliability and deliver the AuditMesh multi-agent capstone.',
    lessons: [
      lesson('llm-gateways', 'Reliability & LLM gateways', 'Centralize provider operations without hiding failure behavior.', [
        'A gateway can centralize credentials, routing, budgets, and rate controls. Keep tenant identity and policy attached to requests, and avoid exposing provider keys to browsers or agent prompts.',
        'Exponential backoff with jitter helps transient failures, but retries require budgets and idempotency. A timeout after a side effect may mean the action succeeded; retrying blindly can create duplicates.',
        'Fallback models can differ in quality, context limits, and output contracts. Verify compatibility and record which provider served the request rather than silently changing behavior.',
      ], 'Define a gateway reliability policy', ['Specify provider routing, credential storage, and per-tenant limits.', 'Define retry and idempotency rules for tools.', 'Test fallback compatibility and budget exhaustion.']),
      lesson('ai-evaluation', 'Evaluation with DeepEval & RAGAS', 'Track quality using representative, reproducible datasets.', [
        'Faithfulness asks whether claims are supported by context; relevance asks whether the answer addresses the question. Context precision and recall help distinguish poor retrieval from poor generation.',
        'LLM-as-a-judge scoring is itself fallible. Calibrate against human-labeled examples and report judge configuration and uncertainty; do not treat one scalar score as proof of correctness.',
        'Version datasets and hold out regression cases. Include permission denials and insufficient-evidence questions, then compare deployment candidates under the same evaluation conditions.',
      ], 'Create a release evaluation dataset', ['Define representative questions with expected evidence.', 'Measure retrieval and answer-quality metrics separately.', 'Set release thresholds and explain judge limitations.']),
      lesson('ai-tracing', 'Tracing with LangSmith & Langfuse', 'Make costs, latency, and tool behavior visible without leaking private data.', [
        'A trace links an incoming request to model calls, retrieval, and tools. Attach stable correlation IDs, record latency and token usage, and distinguish retries from independent work.',
        'Trace payloads can contain prompts, personal data, and credentials. Redact sensitive fields, restrict access, and apply retention controls before enabling verbose production capture.',
        'Compare end-to-end latency and cost with the business SLA. A low average can hide severe tail latency, so inspect percentile behavior and failed requests.',
      ], 'Design a production trace dashboard', ['Specify spans, correlation IDs, and redaction rules.', 'Calculate request cost and latency from sample traces.', 'Define alerts and investigate one slow or failed request.']),
      lesson('auditmesh', 'Capstone: AuditMesh Multi-Agent System', 'Deliver a supervised compliance workflow with human approval and cost evidence.', [
        'Map the manual compliance workflow and identify where evidence collection, review, and approval happen. Agree on the acceptable latency, cost, and authority of each automated step.',
        'Use a LangGraph supervisor to coordinate bounded agents and an MCP tool server for authorized ticketing. Bind human approval to the exact action and make replay-safe execution part of the design.',
        'Deliver a reviewer interface, trace/cost dashboard, and operations handoff. Test policy denial, rejected approval, tool failure, and recovery as carefully as the successful demo.',
      ], 'Deliver the AuditMesh project', ['Submit workflow discovery, trust boundaries, and latency/cost SLAs.', 'Build a supervisor, constrained MCP ticket tool, and approval interface.', 'Provide evaluation results, trace/cost evidence, and an operations handoff.'], 120),
    ],
  },
];

export const FDE_LESSON_COUNT = FDE_MODULES.reduce((count, module) => count + module.lessons.length, 0);
export const FDE_PROGRESS_TOTAL = FDE_LESSON_COUNT * 2;
export const FDE_TOTAL_WEEKS = FDE_MODULES.reduce((weeks, module) => weeks + module.weeks, 0);