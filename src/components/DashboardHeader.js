import React from 'react';

const DashboardHeader = ({
                             subtitle = "App Manager",
                             title,
                             permanentMessage,
                             logoUrl = "/images/smartyapps-logo.png",
                             centerContent
                         }) => {
    return (
        <div className="fixed top-0 left-0 right-0 bg-white z-10 shadow-md">
            {/* Main header content - fixed height only on mobile */}
            <div className="h-[120px] md:h-auto">  {/* Fixed height only on mobile */}
                <div className="max-w-6xl mx-auto px-4 py-3">
                    <div className="flex flex-col items-start md:items-center">
                        <div className="w-full flex flex-col md:flex-row items-start md:items-center md:justify-between">
                            <div className="flex flex-col md:flex-row w-full md:items-center">
                                <div className="flex justify-center md:justify-start">
                                    <img
                                        src={logoUrl}
                                        alt="SmartyApps.AI Logo"
                                        className="h-20 md:h-32 mb-1 md:mb-0"
                                    />
                                </div>
                                <div className="flex-grow flex justify-center">
                                    <div className="md:ml-4 flex flex-col md:border-l md:pl-4 text-center">
                                        <h2 className="text-lg md:text-xl text-gray-600 font-semibold">{subtitle}</h2>
                                        <h1 className="text-xl md:text-2xl font-bold text-gray-800">{title}</h1>
                                        {centerContent && (
                                            <div className="mt-2">{centerContent}</div>
                                        )}
                                    </div>
                                </div>
                                <div className="hidden md:block" style={{width: '128px'}}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Permanent message section - fixed height only on mobile */}
            <div className="h-[60px] md:h-auto bg-white">  {/* Fixed height only on mobile */}
                {permanentMessage && (
                    <div className="w-full max-w-2xl mx-auto px-4">
                        <div
                            className={`p-2 rounded-lg w-full text-center text-sm min-h-[2rem] md:min-h-[2.5rem] flex items-center justify-center ${
                                permanentMessage.content
                                    ? (permanentMessage.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')
                                    : 'bg-gray-50 text-gray-400'
                            }`}
                        >
                            {permanentMessage.content || 'No messages'}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardHeader;