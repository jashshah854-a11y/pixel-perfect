DELETE FROM tool_connections WHERE id IN ('antigravity', 'cursor-ai');
UPDATE tool_connections SET category = 'AI Model' WHERE id = 'perplexity';