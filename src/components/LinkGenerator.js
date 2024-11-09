// components/LinkGenerator.js
import React from 'react';
import { Copy, Loader2 } from 'lucide-react';

const LinkGenerator = ({ title, link, copied, generateFn, copyFn, isGenerating = false }) => (
    <div className="mt-8 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        <button
            onClick={generateFn}
            disabled={isGenerating}
            className="w-full py-4 px-6 text-xl font-semibold bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600 transition duration-300 disabled:bg-blue-300 flex items-center justify-center gap-2"
        >
            {isGenerating && <Loader2 size={24} className="animate-spin" />}
            {isGenerating ? `Generating ${title}...` : `Generate ${title}`}
        </button>
        <div className="mt-4 p-6 bg-gray-100 rounded-lg shadow-md">
            <p className="text-lg font-semibold mb-4">Distributor Registration Link:</p>
            {link ? (
                <div className="flex items-stretch">
                    <div className="flex-grow p-4 bg-white rounded-l-lg border-2 border-r-0 border-gray-300 overflow-x-auto">
                        <p className="text-base whitespace-nowrap">{link}</p>
                    </div>
                    <button
                        onClick={copyFn}
                        className="px-4 bg-gray-200 rounded-r-lg border-2 border-l-0 border-gray-300 hover:bg-gray-300 transition duration-300 flex items-center"
                        title="Copy to clipboard"
                    >
                        <Copy size={24} />
                    </button>
                </div>
            ) : (
                <div className="p-4 bg-white rounded-lg border-2 border-gray-300">
                    <p className="text-base text-gray-500 italic">No link generated yet.</p>
                </div>
            )}
            {copied && (
                <p className="mt-2 text-green-600 font-semibold">Copied to clipboard!</p>
            )}
        </div>
    </div>
);

export default LinkGenerator;