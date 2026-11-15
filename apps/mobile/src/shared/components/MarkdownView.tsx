import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface MarkdownViewProps {
  content: string;
}

interface InlineToken {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

/**
 * Parses bold (**text**), italic (*text*), and inline code (`code`) into text tokens.
 */
function parseInlineMarkdown(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  // Regex matches `code`, **bold**, *italic*
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, match.index) });
    }

    const tokenText = match[0];
    if (tokenText.startsWith('`') && tokenText.endsWith('`')) {
      tokens.push({ text: tokenText.slice(1, -1), code: true });
    } else if (tokenText.startsWith('**') && tokenText.endsWith('**')) {
      tokens.push({ text: tokenText.slice(2, -2), bold: true });
    } else if (tokenText.startsWith('*') && tokenText.endsWith('*')) {
      tokens.push({ text: tokenText.slice(1, -1), italic: true });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex) });
  }

  return tokens.length > 0 ? tokens : [{ text }];
}

export function MarkdownView({ content }: MarkdownViewProps) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Code block toggle (```)
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        elements.push(
          <View key={`code-${i}`} style={styles.codeBlock} testID="markdown-code-block">
            <Text style={styles.codeBlockText}>{codeBlockLines.join('\n')}</Text>
          </View>,
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // Empty lines
    if (!trimmed) {
      elements.push(<View key={`empty-${i}`} style={styles.paragraphSpacer} />);
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      elements.push(
        <Text key={`h3-${i}`} style={styles.h3}>
          {trimmed.replace(/^###\s+/, '')}
        </Text>,
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(
        <Text key={`h2-${i}`} style={styles.h2}>
          {trimmed.replace(/^##\s+/, '')}
        </Text>,
      );
      continue;
    }

    if (trimmed.startsWith('# ')) {
      elements.push(
        <Text key={`h1-${i}`} style={styles.h1}>
          {trimmed.replace(/^#\s+/, '')}
        </Text>,
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      const tokens = parseInlineMarkdown(quoteText);
      elements.push(
        <View key={`quote-${i}`} style={styles.blockquote}>
          <Text style={styles.blockquoteText}>
            {tokens.map((token, idx) => (
              <Text
                key={idx}
                style={[
                  token.bold && styles.bold,
                  token.italic && styles.italic,
                  token.code && styles.inlineCode,
                ]}
              >
                {token.text}
              </Text>
            ))}
          </Text>
        </View>,
      );
      continue;
    }

    // Bullet points (- or *)
    if (/^[-*]\s+/.test(trimmed)) {
      const bulletText = trimmed.replace(/^[-*]\s+/, '');
      const tokens = parseInlineMarkdown(bulletText);
      elements.push(
        <View key={`bullet-${i}`} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bodyText}>
            {tokens.map((token, idx) => (
              <Text
                key={idx}
                style={[
                  token.bold && styles.bold,
                  token.italic && styles.italic,
                  token.code && styles.inlineCode,
                ]}
              >
                {token.text}
              </Text>
            ))}
          </Text>
        </View>,
      );
      continue;
    }

    // Numbered list items (e.g. 1. )
    const numberedMatch = /^(\d+)\.\s+(.*)/.exec(trimmed);
    if (numberedMatch) {
      const num = numberedMatch[1];
      const itemText = numberedMatch[2];
      const tokens = parseInlineMarkdown(itemText);
      elements.push(
        <View key={`num-${i}`} style={styles.bulletRow}>
          <Text style={styles.numberedPrefix}>{num}.</Text>
          <Text style={styles.bodyText}>
            {tokens.map((token, idx) => (
              <Text
                key={idx}
                style={[
                  token.bold && styles.bold,
                  token.italic && styles.italic,
                  token.code && styles.inlineCode,
                ]}
              >
                {token.text}
              </Text>
            ))}
          </Text>
        </View>,
      );
      continue;
    }

    // Standard paragraph with inline formatting
    const tokens = parseInlineMarkdown(rawLine);
    elements.push(
      <Text key={`p-${i}`} style={styles.bodyText}>
        {tokens.map((token, idx) => (
          <Text
            key={idx}
            style={[
              token.bold && styles.bold,
              token.italic && styles.italic,
              token.code && styles.inlineCode,
            ]}
          >
            {token.text}
          </Text>
        ))}
      </Text>,
    );
  }

  // Handle unterminated code block safely
  if (inCodeBlock && codeBlockLines.length > 0) {
    elements.push(
      <View key="unterminated-code" style={styles.codeBlock} testID="markdown-code-block">
        <Text style={styles.codeBlockText}>{codeBlockLines.join('\n')}</Text>
      </View>,
    );
  }

  return <View style={styles.container}>{elements}</View>;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  h1: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 18,
    marginBottom: 8,
    lineHeight: 28,
  },
  h2: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 14,
    marginBottom: 6,
    lineHeight: 24,
  },
  h3: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginTop: 10,
    marginBottom: 4,
    lineHeight: 22,
  },
  bodyText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
    flex: 1,
  },
  bold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  italic: {
    fontStyle: 'italic',
  },
  inlineCode: {
    fontFamily: 'monospace',
    backgroundColor: '#F1F5F9',
    color: '#0369A1',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  paragraphSpacer: {
    height: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 3,
  },
  bulletDot: {
    fontSize: 16,
    color: '#6366F1',
    width: 18,
    lineHeight: 24,
  },
  numberedPrefix: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366F1',
    width: 24,
    lineHeight: 24,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
    paddingLeft: 12,
    marginVertical: 8,
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    borderRadius: 4,
  },
  blockquoteText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#475569',
    lineHeight: 22,
  },
  codeBlock: {
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
  },
  codeBlockText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 20,
  },
});
