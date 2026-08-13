import React, { useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useSettingsState } from '../util/services.js';
import { errorDetails } from '../../../../common/sendLLMMessageTypes.js';


export const ErrorDisplay = ({
	message: message_,
	fullError,
	onDismiss,
	showDismiss,
}: {
	message: string,
	fullError: Error | null,
	onDismiss: (() => void) | null,
	showDismiss?: boolean,
}) => {
	const [isExpanded, setIsExpanded] = useState(false);

	const details = errorDetails(fullError)
	const isExpandable = !!details

	const message = message_ + ''

	return (
		<div className={`rounded-lg border border-vscode-input-validation-error-border bg-vscode-input-validation-error-bg p-4 overflow-auto`}>
			{/* Header */}
			<div className='flex items-start justify-between'>
				<div className='flex gap-3'>
					<AlertCircle className='h-5 w-5 text-vscode-error-fg mt-0.5' />
					<div className='flex-1'>
						<h3 className='font-semibold text-vscode-error-fg'>
							{/* eg Error */}
							Error
						</h3>
						<p className='text-void-fg-1 mt-1'>
							{/* eg Something went wrong */}
							{message}
						</p>
					</div>
				</div>

				<div className='flex gap-2'>
					{isExpandable && (
						<button className='text-vscode-error-fg hover:opacity-80 p-1 rounded'
							onClick={() => setIsExpanded(!isExpanded)}
						>
							{isExpanded ? (
								<ChevronUp className='h-5 w-5' />
							) : (
								<ChevronDown className='h-5 w-5' />
							)}
						</button>
					)}
					{showDismiss && onDismiss && (
						<button className='text-vscode-error-fg hover:opacity-80 p-1 rounded'
							onClick={onDismiss}
						>
							<X className='h-5 w-5' />
						</button>
					)}
				</div>
			</div>

			{/* Expandable Details */}
			{isExpanded && details && (
				<div className='mt-4 space-y-3 border-t border-vscode-input-validation-error-border pt-3 overflow-auto'>
					<div>
						<span className='font-semibold text-vscode-error-fg'>Full Error: </span>
						<pre className='text-void-fg-1'>{details}</pre>
					</div>
				</div>
			)}
		</div>
	);
};
