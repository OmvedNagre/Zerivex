import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Modal } from '@/components/ui/Modal';

describe('Component 13 — Shared Modal / Dialog System', () => {
  it('1. Renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <Modal isOpen={false} onClose={() => {}}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(html).toBe('');
  });

  it('2. Renders with strict WAI-ARIA dialog attributes when open', () => {
    const html = renderToStaticMarkup(
      <Modal
        isOpen={true}
        onClose={() => {}}
        title="Launch Security Assessment"
        description="Select an authorized target endpoint and assessment scope."
        size="md"
      >
        <div>Assessment Form Controls</div>
      </Modal>
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="modal-title-');
    expect(html).toContain('aria-describedby="modal-desc-');
    expect(html).toContain('Launch Security Assessment');
    expect(html).toContain('Select an authorized target endpoint and assessment scope.');
    expect(html).toContain('Assessment Form Controls');
  });

  it('3. Renders accessible close button with accessible label and 44px hit area class', () => {
    const html = renderToStaticMarkup(
      <Modal
        isOpen={true}
        onClose={() => {}}
        title="Test Modal"
        closeButtonLabel="Dismiss dialog"
      >
        <p>Content</p>
      </Modal>
    );

    expect(html).toContain('class="zmd-close-btn "');
    expect(html).toContain('aria-label="Dismiss dialog"');
    expect(html).toContain('title="Dismiss dialog (Escape)"');
  });

  it('4. Supports alertdialog role for destructive confirmation workflows', () => {
    const html = renderToStaticMarkup(
      <Modal
        isOpen={true}
        onClose={() => {}}
        title="Delete Target Asset?"
        description="This action cannot be undone."
        role="alertdialog"
        size="sm"
      >
        <p>Warning details</p>
      </Modal>
    );

    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('class="zmd-dialog zmd-size-sm "');
  });

  it('5. Supports all standard size variants (sm, md, lg, xl, full)', () => {
    const sizes = ['sm', 'md', 'lg', 'xl', 'full'] as const;

    sizes.forEach((size) => {
      const html = renderToStaticMarkup(
        <Modal
          isOpen={true}
          onClose={() => {}}
          title={`${size} modal`}
          size={size}
        >
          <div>Body</div>
        </Modal>
      );

      expect(html).toContain(`zmd-size-${size}`);
    });
  });

  it('6. Supports compound components (Modal.Header, Modal.Body, Modal.Footer)', () => {
    const html = renderToStaticMarkup(
      <Modal
        isOpen={true}
        onClose={() => {}}
        size="lg"
        ariaLabel="Custom Composed Modal"
      >
        <Modal.Header>
          <Modal.Title id="custom-title">Composed Title</Modal.Title>
          <Modal.Description id="custom-desc">Composed Description</Modal.Description>
          <Modal.CloseButton label="Close custom dialog" />
        </Modal.Header>
        <Modal.Body>
          <div>Custom Body Content</div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button">Cancel</button>
          <button type="button">Confirm</button>
        </Modal.Footer>
      </Modal>
    );

    expect(html).toContain('class="zmd-header "');
    expect(html).toContain('id="custom-title"');
    expect(html).toContain('Composed Title');
    expect(html).toContain('id="custom-desc"');
    expect(html).toContain('Composed Description');
    expect(html).toContain('aria-label="Close custom dialog"');
    expect(html).toContain('class="zmd-body "');
    expect(html).toContain('Custom Body Content');
    expect(html).toContain('class="zmd-footer "');
  });

  it('7. Supports declarative footer prop', () => {
    const html = renderToStaticMarkup(
      <Modal
        isOpen={true}
        onClose={() => {}}
        title="Modal with Footer"
        footer={<button type="button">Save Action</button>}
      >
        <p>Content with footer</p>
      </Modal>
    );

    expect(html).toContain('class="zmd-footer "');
    expect(html).toContain('Save Action');
  });

  it('8. Supports custom aria-label when no visible title is rendered', () => {
    const html = renderToStaticMarkup(
      <Modal
        isOpen={true}
        onClose={() => {}}
        ariaLabel="Standalone Technical Workstation"
      >
        <div>Headless content</div>
      </Modal>
    );

    expect(html).toContain('aria-label="Standalone Technical Workstation"');
    expect(html).not.toContain('zmd-header');
  });

  it('9. Enforces Zero AI-Slop: No emojis or pseudo-futuristic cyber gimmicks', () => {
    const html = renderToStaticMarkup(
      <Modal
        isOpen={true}
        onClose={() => {}}
        title="Enterprise Security Modal"
        description="Deterministic vulnerability verification"
      >
        <div>Protected workspace content</div>
      </Modal>
    );

    expect(html).not.toContain('⚡');
    expect(html).not.toContain('🚀');
    expect(html).not.toContain('🛡️');
    expect(html).not.toContain('🔐');
  });

  it('10. Renders cleanly in SSR environment without window or document errors', () => {
    expect(() => {
      renderToStaticMarkup(
        <Modal
          isOpen={true}
          onClose={() => {}}
          title="SSR Validation"
          description="Verifying static server-side rendering capability"
        >
          <span>Server Rendered Content</span>
        </Modal>
      );
    }).not.toThrow();
  });
});
