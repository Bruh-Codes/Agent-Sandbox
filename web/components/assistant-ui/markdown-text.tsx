"use client";

import {
	MarkdownTextPrimitive,
	unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
} from "@assistant-ui/react-markdown";
import "@assistant-ui/react-markdown/styles/dot.css";
import remarkGfm from "remark-gfm";
import { memo, type FC } from "react";
import { cn } from "@/lib/utils";

const SECTION_HEADINGS = [
	"Verdict",
	"Main reason",
	"Estimated budget or shortfall",
	"Important assumptions or risks",
	"Best next action",
] as const;

function preprocessMarkdown(text: string): string {
	let processed = text;

	for (const heading of SECTION_HEADINGS) {
		const pattern = new RegExp(
			`(^|\\n)\\s*(?:#{1,6}\\s*)?${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:?\\s*`,
			"gi",
		);
		processed = processed.replace(pattern, `\n\n## ${heading}\n\n`);
	}

	// Single newlines become hard breaks so plain-text sections stay on separate lines.
	return processed.replace(/(?<!\n)\n(?!\n)/g, "  \n");
}

const defaultComponents = memoizeMarkdownComponents({
	h1: ({ className, ...props }) => (
		<h1
			className={cn("mb-3 mt-4 text-xl font-semibold first:mt-0", className)}
			{...props}
		/>
	),
	h2: ({ className, ...props }) => (
		<h2
			className={cn(
				"mb-2 mt-5 border-b border-border/40 pb-1 text-base font-semibold first:mt-0",
				className,
			)}
			{...props}
		/>
	),
	h3: ({ className, ...props }) => (
		<h3
			className={cn("mb-2 mt-4 text-sm font-semibold first:mt-0", className)}
			{...props}
		/>
	),
	p: ({ className, ...props }) => (
		<p className={cn("mb-3 leading-relaxed last:mb-0", className)} {...props} />
	),
	ul: ({ className, ...props }) => (
		<ul
			className={cn("mb-3 ml-5 list-disc space-y-1 last:mb-0", className)}
			{...props}
		/>
	),
	ol: ({ className, ...props }) => (
		<ol
			className={cn("mb-3 ml-5 list-decimal space-y-1 last:mb-0", className)}
			{...props}
		/>
	),
	li: ({ className, ...props }) => (
		<li className={cn("leading-relaxed", className)} {...props} />
	),
	strong: ({ className, ...props }) => (
		<strong className={cn("font-semibold", className)} {...props} />
	),
	blockquote: ({ className, ...props }) => (
		<blockquote
			className={cn(
				"border-border/60 text-muted-foreground my-3 border-l-2 pl-4 italic",
				className,
			)}
			{...props}
		/>
	),
	hr: ({ className, ...props }) => (
		<hr className={cn("border-border/60 my-4", className)} {...props} />
	),
});

const MarkdownTextImpl: FC = () => (
	<MarkdownTextPrimitive
		remarkPlugins={[remarkGfm]}
		className="aui-md"
		components={defaultComponents}
		preprocess={preprocessMarkdown}
	/>
);

export const MarkdownText = memo(MarkdownTextImpl);
