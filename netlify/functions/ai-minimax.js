const { getUserFromEvent } = require('./_lib/auth');

function pickAssistantMarkdown(resp) {
  return (
    resp?.choices?.[0]?.message?.content ||
    resp?.choices?.[0]?.text ||
    resp?.output_text ||
    resp?.result ||
    resp?.reply ||
    ''
  );
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const user = await getUserFromEvent(event);
    if (!user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    const apiKey = process.env.MINIMAX_API_KEY;
    const groupId = process.env.MINIMAX_GROUP_ID;
    const apiUrl =
      process.env.MINIMAX_API_URL || 'https://api.minimax.chat/v1/text/chatcompletion_pro';
    const model = process.env.MINIMAX_MODEL || 'abab6.5-chat';

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing MINIMAX_API_KEY' })
      };
    }

    const payload = JSON.parse(event.body || '{}');
    const question = typeof payload.question === 'string' ? payload.question.trim() : '';
    const content = typeof payload.content === 'string' ? payload.content : '';
    const format = payload.format === 'latex' ? 'latex' : 'markdown';
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';

    if (!question) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'question is required' })
      };
    }

    const promptParts = [
      `用户问题：\n${question}`,
      title ? `当前标题：\n${title}` : '',
      content ? `当前内容（${format}）：\n${content}` : ''
    ].filter(Boolean);

    const prompt = `${promptParts.join('\n\n')}\n\n请直接输出 Markdown（不要输出代码块包裹的 Markdown）。`;

    const url = groupId ? `${apiUrl}?GroupId=${encodeURIComponent(groupId)}` : apiUrl;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              '你是一个写作/整理助手。你只能输出 Markdown，内容要结构清晰、可直接粘贴发布。'
          },
          { role: 'user', content: prompt }
        ]
      })
    });

    const raw = await resp.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_err) {
      data = { error: 'MiniMax returned non-JSON', raw };
    }

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        body: JSON.stringify({ error: data?.error || 'MiniMax request failed', raw })
      };
    }

    const markdown = pickAssistantMarkdown(data).trim();
    if (!markdown) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'MiniMax returned empty content', raw })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ markdown })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    };
  }
};

