import React, { useEffect, useRef, useState } from 'react'
import { Send, Loader2, Sparkles, Square } from 'lucide-react'
import { AskBrainReference } from '../../../../common/projectBrain/projectBrainTypes.js'
import { Card, EmptyHint, useOpenProjectFile } from './shared.js'
import { useAccessor } from '../util/services.js'

const SUGGESTED_PROMPTS = [
	'Explain the architecture',
	'Find security risks',
	'Explain project structure',
	'How does authentication work?',
]

export const AskSection = ({ prefillQuestion }: { prefillQuestion?: string }) => {
	const accessor = useAccessor()
	const openFile = useOpenProjectFile()

	const [question, setQuestion] = useState(prefillQuestion ?? '')
	const [answer, setAnswer] = useState('')
	const [references, setReferences] = useState<AskBrainReference[]>([])
	const [isStreaming, setIsStreaming] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const requestIdRef = useRef<string | null>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (prefillQuestion) setQuestion(prefillQuestion)
	}, [prefillQuestion])

	const ask = (q?: string) => {
		const text = (q ?? question).trim()
		if (!text || isStreaming) return
		setQuestion(text)
		setAnswer('')
		setReferences([])
		setError(null)
		setIsStreaming(true)
		requestIdRef.current = accessor.get('IProjectBrainService').askBrain(text, {
			onText: (fullTextSoFar) => setAnswer(fullTextSoFar),
			onFinalMessage: (fullText, refs) => { setAnswer(fullText); setReferences(refs); setIsStreaming(false) },
			onError: (message) => { setError(message); setIsStreaming(false) },
		})
	}

	const abort = () => {
		if (requestIdRef.current) accessor.get('IProjectBrainService').abortAsk(requestIdRef.current)
		setIsStreaming(false)
	}

	const hasConversation = !!(answer || isStreaming || error)

	return <div className='max-w-2xl flex flex-col'>
		<div className='flex items-center gap-2 mb-3'>
			<Sparkles className='size-4 text-void-fg-2' />
			<h2 className='text-sm font-semibold text-void-fg-1'>Ask Brain</h2>
		</div>

		<div className={`relative flex items-center rounded-lg border bg-void-bg-1-alt transition-colors ${isStreaming ? 'border-void-border-2' : 'focus-within:border-void-border-1 focus-within:ring-1 focus-within:ring-void-border-1 border-void-border-2'}`}>
			<input
				ref={inputRef}
				value={question}
				onChange={e => setQuestion(e.target.value)}
				onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }}
				placeholder='Ask anything about this project…'
				className='flex-1 text-sm bg-transparent pl-4 pr-2 py-3 text-void-fg-1 placeholder:text-void-fg-4 focus:outline-none'
			/>
			{isStreaming
				? <button onClick={abort} aria-label='Stop generating' title='Stop generating' className='m-1.5 flex items-center gap-1.5 text-xs text-void-fg-2 border border-void-border-2 rounded-md px-3 py-1.5 hover:bg-void-bg-2-hover transition-colors'>
					<Square className='size-3' fill='currentColor' /> Stop
				</button>
				: <button onClick={() => ask()} disabled={!question.trim()} aria-label='Ask' className='m-1.5 flex items-center justify-center size-8 rounded-md text-vscode-button-fg bg-vscode-button-bg hover:bg-vscode-button-hover-bg disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
					<Send className='size-3.5' />
				</button>}
		</div>

		{!hasConversation && <div className='mt-3'>
			<div className='text-[10px] uppercase tracking-wide text-void-fg-4 mb-1.5'>Suggested</div>
			<div className='flex flex-wrap gap-1.5'>
				{SUGGESTED_PROMPTS.map(p => (
					<button key={p} onClick={() => ask(p)} className='text-[11px] text-void-fg-2 bg-void-bg-2 border border-void-border-2 rounded-full px-2.5 py-1 hover:bg-void-bg-2-hover hover:text-void-fg-1 transition-colors'>
						{p}
					</button>
				))}
			</div>
		</div>}

		{error && <p className='text-xs text-red-500 mt-3'>{error}</p>}

		{(answer || isStreaming) && <Card className='p-3.5 mt-4'>
			{references.length > 0 && <div className='flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-void-border-2'>
				{references.map(r => (
					<button key={r.relPath} onClick={() => openFile(r.relPath)} title={r.reason}
						className='text-[11px] text-void-fg-2 bg-void-bg-2 border border-void-border-2 rounded px-1.5 py-0.5 hover:bg-void-bg-2-hover font-mono'>
						{r.relPath}
					</button>
				))}
			</div>}
			<div className='text-xs text-void-fg-1 whitespace-pre-wrap leading-relaxed'>{answer}</div>
			{isStreaming && !answer && <div className='flex items-center gap-1.5 text-void-fg-3'>
				<Loader2 className='size-3.5 animate-spin' />
				<span className='text-xs'>Thinking…</span>
			</div>}
			{isStreaming && answer && <Loader2 className='size-3.5 animate-spin text-void-fg-3 mt-2' />}
		</Card>}

		{!hasConversation && (
			<EmptyHint>Ask how a feature works, where something is implemented, or what a file is responsible for. Answers are generated from Project Brain's indexed understanding of this repo, with clickable file references.</EmptyHint>
		)}
	</div>
}
