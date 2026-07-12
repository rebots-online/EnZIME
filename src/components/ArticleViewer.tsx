import { useEffect, useRef, useState } from 'react';
import { zimGetArticle, annotationsList, Annotation, Region } from '../bridge';

interface ArticleViewerProps {
  handle: number;
  url: string;
}

export function ArticleViewer({ handle, url }: ArticleViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string>('');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  useEffect(() => {
    const loadArticle = async () => {
      try {
        const articleHtml = await zimGetArticle(handle, url);

        // Inject Literata font and reading surface styles
        const styledHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8"/>
            <link href="https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,200..900;1,7..72,200..900&display=swap" rel="stylesheet"/>
            <style>
              body {
                font-family: 'Literata', serif;
                max-width: 720px;
                margin: 0 auto;
                padding: 16px;
                line-height: 1.6;
                color: #d4e4fa;
              }
              .annotation-highlight {
                background-color: rgba(20, 184, 166, 0.3);
                border-bottom: 2px solid rgba(20, 184, 166, 0.4);
                cursor: pointer;
              }
              .annotation-note {
                background-color: rgba(79, 219, 200, 0.2);
                border-bottom: 2px dashed rgba(79, 219, 200, 0.5);
                cursor: pointer;
              }
              .annotation-ai {
                background-color: rgba(79, 219, 200, 0.15);
                border-bottom: 2px dotted rgba(79, 219, 200, 0.6);
                cursor: pointer;
              }
            </style>
          </head>
          <body>
            ${articleHtml}
          </body>
          </html>
        `;

        setHtml(styledHtml);
      } catch (error) {
        console.error('Failed to load article:', error);
        setHtml('<p>Error loading article</p>');
      }
    };

    loadArticle();
  }, [handle, url]);

  useEffect(() => {
    const loadAnnotations = async () => {
      try {
        const annotationList = await annotationsList(handle, url);
        setAnnotations(annotationList);
      } catch (error) {
        console.error('Failed to load annotations:', error);
      }
    };

    loadAnnotations();
  }, [handle, url]);

  // Paint annotation highlights
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentDocument) return;

    const doc = iframe.contentDocument;

    // Clear existing highlights
    doc.querySelectorAll('.annotation-highlight, .annotation-note, .annotation-ai').forEach(el => {
      el.classList.remove('annotation-highlight', 'annotation-note', 'annotation-ai');
    });

    // Apply annotation highlights
    annotations.forEach(annotation => {
      if (annotation.region.Char) {
        const { start, end } = annotation.region.Char;
        const textNodes = doc.evaluate('//text()', doc, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
        let charOffset = 0;

        for (let i = 0; i < textNodes.snapshotLength; i++) {
          const node = textNodes.snapshotItem(i) as Text;
          const nodeLength = node.textContent?.length || 0;

          if (charOffset + nodeLength > start && charOffset < end) {
            const range = doc.createRange();
            const span = doc.createElement('span');

            const startOffset = Math.max(0, start - charOffset);
            const endOffset = Math.min(nodeLength, end - charOffset);

            range.setStart(node, startOffset);
            range.setEnd(node, endOffset);
            range.surroundContents(span);

            // Apply annotation class based on type
            if (annotation.body.startsWith('highlight:')) {
              span.classList.add('annotation-highlight');
            } else if (annotation.body.startsWith('note:')) {
              span.classList.add('annotation-note');
            } else if (annotation.body.startsWith('ai:')) {
              span.classList.add('annotation-ai');
            }

            break;
          }

          charOffset += nodeLength;
        }
      }
    });
  }, [annotations, html]);

  return (
    <iframe
      ref={iframeRef}
      title={`Article: ${url}`}
      sandbox="allow-same-origin"
      srcDoc={html} // srcdoc in DOM
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
      }}
    />
  );
}
