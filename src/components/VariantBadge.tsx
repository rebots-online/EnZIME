import { Variant } from '../bridge';

// E-FE-14: Header chip displaying AI model variant
// "AI: Full" for Qwen3_06B_Q4, "AI: Lite" for GemmaE2bQ4
// Stitch chip styling: pill shape, teal when Full
export function VariantBadge({ variant }: { variant: Variant }) {
	const isFull = variant === Variant.Qwen3_06B_Q4;
	const label = isFull ? 'AI: Full' : 'AI: Lite';

	// DESIGN.md colors: primary-container #14b8a6 (teal for Full), on-primary #003731 (dark text)
	// For Lite: secondary style with outline, on-surface #d4e4fa
	const chipStyle: React.CSSProperties = {
		display: 'inline-flex',
		alignItems: 'center',
		padding: '4px 12px',
		borderRadius: '9999px', // pill shape per DESIGN.md "chips pill"
		fontSize: '12px',
		fontWeight: '600',
		fontFamily: 'Space Grotesk, sans-serif',
		letterSpacing: '0.05em',
		textTransform: 'uppercase',
		backgroundColor: isFull ? '#14b8a6' : 'transparent',
		color: isFull ? '#003731' : '#d4e4fa',
		border: isFull ? 'none' : '1px solid #859490',
		transition: 'all 0.2s ease',
	};

	return <span style={chipStyle}>{label}</span>;
}
