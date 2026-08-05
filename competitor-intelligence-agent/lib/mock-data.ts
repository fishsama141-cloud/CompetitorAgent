export type {
  Competitor,
  TaskStatusWithMeta as TaskStatus,
  SearchResult,
  Citation,
  SwotItem,
  SwotMatrix,
  Evaluations,
  EvaluationRun,
  ChatMessage,
  CrawlRequest,
  SearchRequest,
  SwotGenerateRequest,
  ChatRequest,
  EvaluationRequest,
} from '@/lib/types'

import type {
  Competitor,
  TaskStatusWithMeta as TaskStatus,
  SearchResult,
  Citation,
  SwotItem,
  SwotMatrix,
  Evaluations,
  EvaluationRun,
  ChatMessage,
} from '@/lib/types'

export const competitors: Competitor[] = [
  {
    competitor_id: 'cmp_001',
    name: 'DeepSeek',
    category: 'AI Assistant',
    official_url: 'https://deepseek.com',
    latest_update: '2026-08-01',
    document_count: 120,
  },
  {
    competitor_id: 'cmp_002',
    name: '豆包',
    category: 'AI Assistant',
    official_url: 'https://www.doubao.com',
    latest_update: '2026-07-30',
    document_count: 86,
  },
  {
    competitor_id: 'cmp_003',
    name: 'Kimi',
    category: 'AI Assistant',
    official_url: 'https://kimi.moonshot.cn',
    latest_update: '2026-07-28',
    document_count: 64,
  },
  {
    competitor_id: 'cmp_004',
    name: 'Perplexity',
    category: 'Search',
    official_url: 'https://perplexity.ai',
    latest_update: '2026-07-25',
    document_count: 41,
  },
]

export const crawlTasks: TaskStatus[] = [
  {
    task_id: 'crawl_001',
    competitor: 'DeepSeek',
    source_url: 'https://deepseek.com/news',
    source_type: 'changelog',
    status: 'completed',
    progress_percentage: 100,
    documents_created: 35,
    error_message: null,
  },
  {
    task_id: 'crawl_002',
    competitor: '豆包',
    source_url: 'https://apps.apple.com/cn/app/doubao/id6459063452',
    source_type: 'app_store',
    status: 'processing',
    progress_percentage: 62,
    documents_created: 18,
    error_message: null,
  },
  {
    task_id: 'crawl_003',
    competitor: 'Kimi',
    source_url: 'https://kimi.moonshot.cn/changelog',
    source_type: 'changelog',
    status: 'completed',
    progress_percentage: 100,
    documents_created: 27,
    error_message: null,
  },
  {
    task_id: 'crawl_004',
    competitor: 'Perplexity',
    source_url: 'https://perplexity.ai/hub/blog',
    source_type: 'custom_url',
    status: 'failed',
    progress_percentage: 34,
    documents_created: 0,
    error_message: 'HTTP 403 — 目标站点已启用 Cloudflare 防护，建议切换为 API 采集通道',
  },
  {
    task_id: 'crawl_005',
    competitor: 'DeepSeek',
    source_url: 'https://apps.apple.com/cn/app/deepseek/id6737597349',
    source_type: 'app_store',
    status: 'processing',
    progress_percentage: 88,
    documents_created: 42,
    error_message: null,
  },
]

export const searchResults: SearchResult[] = [
  {
    chunk_id: 'chunk_001',
    content:
      'DeepSeek 新增深度搜索能力，可在推理链中并行调用检索工具，复杂问题的引用准确率提升明显。',
    source: '官方更新日志',
    similarity_score: 0.93,
  },
  {
    chunk_id: 'chunk_002',
    content:
      '高峰时段（20:00–23:00）用户频繁反馈“服务器繁忙，请稍后再试”，长对话上下文偶发丢失。',
    source: 'App Store 评论',
    similarity_score: 0.88,
  },
  {
    chunk_id: 'chunk_003',
    content:
      '开放平台上线深度 API 与批量推理定价，面向企业客户提供私有化部署与专属算力池。',
    source: 'Changelog',
    similarity_score: 0.85,
  },
  {
    chunk_id: 'chunk_004',
    content:
      '头部厂商通过降价补贴与预装渠道争夺入口级用户，中小模型厂商获客成本持续走高。',
    source: '行业报告',
    similarity_score: 0.81,
  },
  {
    chunk_id: 'chunk_005',
    content:
      '移动端新增语音打断与实时字幕，多模态输入在弱网环境下的成功率仍待优化。',
    source: '产品评测',
    similarity_score: 0.77,
  },
]

export const swotMatrix: SwotMatrix = {
  strengths: [
    {
      point: '模型推理能力强，深度思考链路响应稳定',
      citation: {
        chunk_id: 'chunk_001',
        source_title: 'App Store 评论',
        raw_text_snippet:
          '深度推理模式响应速度极快，数学与代码题的解题步骤比同类产品更完整。',
      },
      confidence: 0.92,
    },
    {
      point: '开源生态活跃，开发者二次分发形成自然流量',
      citation: {
        chunk_id: 'chunk_003',
        source_title: 'Changelog',
        raw_text_snippet:
          '权重与技术报告同步开源，社区一周内产出超过 200 个衍生微调版本。',
      },
      confidence: 0.89,
    },
    {
      point: '单位 Token 成本优势显著，价格敏感客群转化率高',
      citation: {
        chunk_id: 'chunk_003',
        source_title: '开放平台定价页',
        raw_text_snippet: '批量推理时段折扣可低至标准价的 25%。',
      },
      confidence: 0.86,
    },
  ],
  weaknesses: [
    {
      point: '高峰期服务不稳定，长会话易超时',
      citation: {
        chunk_id: 'chunk_002',
        source_title: 'App Store 评论',
        raw_text_snippet: '经常提示网络连接超时，需要反复重发才能拿到结果。',
      },
      confidence: 0.88,
    },
    {
      point: '多模态能力落后，图像与语音链路体验割裂',
      citation: {
        chunk_id: 'chunk_005',
        source_title: '产品评测',
        raw_text_snippet: '图片理解仅支持单张，语音打断在弱网下经常失败。',
      },
      confidence: 0.83,
    },
    {
      point: '企业级权限与审计功能缺失，采购流程受阻',
      citation: {
        chunk_id: 'chunk_003',
        source_title: '销售访谈记录',
        raw_text_snippet: '客户反馈缺少 SSO 与操作审计日志，无法通过内部安全评审。',
      },
      confidence: 0.79,
    },
  ],
  opportunities: [
    {
      point: '企业 API 市场高速增长，可切入垂直行业方案',
      citation: {
        chunk_id: 'chunk_003',
        source_title: 'Changelog',
        raw_text_snippet: '上线深度 API 开放平台，首月接入企业客户超过 3,000 家。',
      },
      confidence: 0.85,
    },
    {
      point: 'Agent 工作流场景空白，可率先建立标准',
      citation: {
        chunk_id: 'chunk_001',
        source_title: '行业报告',
        raw_text_snippet: '仅 12% 的厂商提供可编排的多步 Agent 能力。',
      },
      confidence: 0.8,
    },
    {
      point: '海外华语市场渠道未被充分覆盖',
      citation: {
        chunk_id: 'chunk_004',
        source_title: '市场调研',
        raw_text_snippet: '东南亚华语用户的月活增速为国内市场的 2.4 倍。',
      },
      confidence: 0.74,
    },
  ],
  threats: [
    {
      point: '大厂降价补贴争夺入口，获客成本抬升',
      citation: {
        chunk_id: 'chunk_004',
        source_title: '行业报告',
        raw_text_snippet: '巨头降价补贴进行用户争夺，单用户获取成本上涨 41%。',
      },
      confidence: 0.81,
    },
    {
      point: '端侧模型崛起，云端调用量面临替代风险',
      citation: {
        chunk_id: 'chunk_005',
        source_title: '技术趋势简报',
        raw_text_snippet: '旗舰机型已可本地运行 7B 级模型，日常问答无需联网。',
      },
      confidence: 0.76,
    },
    {
      point: '合规与数据出境政策变化带来不确定性',
      citation: {
        chunk_id: 'chunk_002',
        source_title: '政策解读',
        raw_text_snippet: '新规要求训练语料来源可追溯，审计周期延长至 90 天。',
      },
      confidence: 0.72,
    },
  ],
}

export const recommendations = [
  {
    title: '优先补齐高峰期稳定性',
    detail:
      '以“对话不中断”为核心卖点，在营销与产品页强调 SLA 与失败重试机制，直接命中竞品最高频差评。',
    impact: 'high' as const,
  },
  {
    title: '推出企业治理套件',
    detail:
      '交付 SSO、审计日志、数据保留策略三件套，解锁被安全评审卡住的中大型客户采购流程。',
    impact: 'high' as const,
  },
  {
    title: '抢占 Agent 工作流标准',
    detail:
      '开放可视化编排与工具市场，形成开发者迁移成本，在竞品补齐前建立生态壁垒。',
    impact: 'medium' as const,
  },
  {
    title: '强化多模态弱网体验',
    detail:
      '针对语音打断与图片批量理解做端侧降级方案，把竞品的体验割裂点转化为差异化优势。',
    impact: 'medium' as const,
  },
  {
    title: '布局海外华语渠道',
    detail:
      '以东南亚市场为切入口，联合本地分发渠道做定向投放，抢占增速更高的增量人群。',
    impact: 'low' as const,
  },
]

export const evaluations: Evaluations = {
  faithfulness: 0.95,
  citation_accuracy: 0.92,
  completeness: 0.9,
  hallucination_rate: 0.03,
}

export const evaluationHistory: EvaluationRun[] = [
  {
    report_id: 'rpt_20260801_swot',
    evaluated_at: '2026-08-01 14:22',
    status: 'passed',
    scores: {
      faithfulness: 0.95,
      citation_accuracy: 0.92,
      completeness: 0.9,
      hallucination_rate: 0.03,
    },
  },
  {
    report_id: 'rpt_20260728_swot',
    evaluated_at: '2026-07-28 09:41',
    status: 'passed',
    scores: {
      faithfulness: 0.93,
      citation_accuracy: 0.9,
      completeness: 0.88,
      hallucination_rate: 0.05,
    },
  },
  {
    report_id: 'rpt_20260722_swot',
    evaluated_at: '2026-07-22 17:08',
    status: 'failed',
    scores: {
      faithfulness: 0.78,
      citation_accuracy: 0.71,
      completeness: 0.69,
      hallucination_rate: 0.19,
    },
  },
  {
    report_id: 'rpt_20260715_swot',
    evaluated_at: '2026-07-15 11:30',
    status: 'passed',
    scores: {
      faithfulness: 0.91,
      citation_accuracy: 0.89,
      completeness: 0.86,
      hallucination_rate: 0.06,
    },
  },
]

export const initialChat: ChatMessage[] = [
  {
    id: 'msg_001',
    role: 'user',
    content: 'DeepSeek 最近的更新里，哪些能力对我们威胁最大？',
  },
  {
    id: 'msg_002',
    role: 'assistant',
    content:
      '综合最近 30 天的更新日志与应用商店评论，威胁最大的是深度搜索与推理链路的整合[chunk_001]，它把检索能力直接嵌入思考过程，显著提升了复杂问题的引用准确率。其次是开放平台的深度 API 与批量推理定价[chunk_003]，价格策略会直接压缩我们在企业侧的报价空间。可利用的缺口在于高峰期稳定性——用户仍高频反馈超时与上下文丢失[chunk_002]。',
    citations: [
      {
        chunk_id: 'chunk_001',
        source_title: '官方更新日志',
        raw_text_snippet:
          'DeepSeek 新增深度搜索能力，可在推理链中并行调用检索工具。',
      },
      {
        chunk_id: 'chunk_003',
        source_title: 'Changelog',
        raw_text_snippet:
          '开放平台上线深度 API 与批量推理定价，面向企业客户提供私有化部署。',
      },
      {
        chunk_id: 'chunk_002',
        source_title: 'App Store 评论',
        raw_text_snippet: '经常提示网络连接超时，需要反复重发才能拿到结果。',
      },
    ],
  },
]

export const domains = [
  'AI Assistant',
  'Ecommerce',
  'Search',
  'Developer Tools',
  'Enterprise SaaS',
]

export const sourceTypes: { value: TaskStatus['source_type']; label: string }[] =
  [
    { value: 'changelog', label: 'changelog · 更新日志' },
    { value: 'app_store', label: 'app_store · 应用商店评论' },
    { value: 'custom_url', label: 'custom_url · 自定义网页' },
  ]
