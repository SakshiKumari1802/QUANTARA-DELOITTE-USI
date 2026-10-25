import * as React from "react";
import axios from "axios";
import { Newspaper, Loader2, AlertCircle } from "lucide-react";
// Removed ScrollArea import as we are removing internal scrolling
// import { ScrollArea } from "./ui/scroll-area";

interface NewsPanelProps {
    cities: string[];
    isDarkMode?: boolean;
}

interface NewsArticle {
    uuid: string;
    title: string;
    description: string;
    url: string;
    image_url: string;
    source: string;
    published_at: string;
}

const API_KEY = import.meta.env.VITE_NEWS_API_KEY || "yDS4kdTKxmeraPbux5dnkl8oqRYCDRBH57fBCLVq";
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export function NewsPanel({ cities, isDarkMode = false }: NewsPanelProps) {
    const [articles, setArticles] = React.useState<NewsArticle[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Stable key for dependencies
    const citiesKey = React.useMemo(() => cities.sort().join(','), [cities]);

    React.useEffect(() => {
        const fetchNews = async () => {
            if (!cities || cities.length === 0) return;

            const cacheKey = `news_cache_${citiesKey}`;
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                const { timestamp, data } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_DURATION) {
                    console.log("Using cached news for:", citiesKey);
                    setArticles(data);
                    return;
                }
            }

            setIsLoading(true);
            setError(null);

            try {
                console.log("Fetching fresh news for:", citiesKey);

                // Calculate date 5 days ago for "Latest" filter
                const date = new Date();
                date.setDate(date.getDate() - 5);
                const publishedAfter = date.toISOString().split('T')[0]; // YYYY-MM-DD

                // SYNTAX FIX: TheNewsAPI uses symbols: | for OR, + for AND
                // Cities: (Mumbai | Jaipur | Surat)
                const citySection = `(${cities.map(c => `"${c}"`).join(" | ")})`;

                // User Requested Strict Keywords
                const logisticsKeywords = `(logistics | transport | highway | infrastructure | freight | truck | road | accident | diversion | traffic)`;

                // Full Query: (Cities) + (Keywords)
                // note: " + " strict AND operator
                let initialQuery = `${citySection} + ${logisticsKeywords}`;

                let response = await axios.get("https://api.thenewsapi.com/v1/news/all", {
                    params: {
                        api_token: API_KEY,
                        search: initialQuery,
                        language: "en",
                        limit: 7,
                        categories: "business,tech,general",
                        sort: "published_at",
                        published_after: publishedAfter
                    }
                });

                let data = response.data?.data || [];

                // STRATEGY 2: Broad "India" + Strict Topics (Real Data)
                // If city-specific transport news is missing, we check India-wide transport news.
                if (data.length === 0) {
                    console.log("No city news found. Fetching broad India Logistics/Transport news...");
                    const indiaQuery = `(India) + ${logisticsKeywords}`;
                    try {
                        const indiaResponse = await axios.get("https://api.thenewsapi.com/v1/news/all", {
                            params: {
                                api_token: API_KEY,
                                search: indiaQuery,
                                language: "en",
                                limit: 7,
                                categories: "business,tech,general",
                                sort: "published_at",
                                published_after: publishedAfter
                            }
                        });
                        data = indiaResponse.data?.data || [];
                    } catch (e) {
                        console.warn("Strategy 2 failed", e);
                    }
                }

                // STRATEGY 3: Final Fallback to Mock Data (Demo Mode)
                if (data.length === 0) {
                    console.log("Still no data. Switching to Mock Data.");
                    data = getMockNews();
                }

                if (data.length > 0) {
                    sessionStorage.setItem(cacheKey, JSON.stringify({
                        timestamp: Date.now(),
                        data: data
                    }));
                }

                setArticles(data);

            } catch (err: any) {
                console.error("News API Error:", err);
                setArticles(getMockNews());
            } finally {
                setIsLoading(false);
            }
        };

        fetchNews();
    }, [citiesKey]);

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
        } catch (e) {
            return "";
        }
    };

    return (
        <div className={`rounded-xl shadow-lg border ${isDarkMode
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
            } p-4`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Newspaper className={`w-4 h-4 ${isDarkMode ? 'text-lime-400' : 'text-lime-600'}`} />
                    <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Route News
                    </span>
                </div>
                <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {isLoading ? 'Updating...' : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm transition-transform hover:scale-105 ${articles.some(a => a.uuid.startsWith('mock'))
                            ? 'bg-yellow-100/80 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400 border border-yellow-200/50 dark:border-yellow-700/50'
                            : 'bg-green-100/80 text-green-700 dark:bg-green-900/40 dark:text-green-400 border border-green-200/50 dark:border-green-700/50'
                            }`}>
                            {articles.some(a => a.uuid.startsWith('mock')) ? 'Demo Data' : 'Live Feed'}
                        </span>
                    )}
                </span>
            </div>

            <div className="space-y-4">
                {isLoading && articles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-lime-500" />
                        <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Fetching tailored news...
                        </span>
                    </div>
                ) : null}

                {articles.length > 0 && (
                    <div className="space-y-3">
                        {articles.map((article) => (
                            <a
                                key={article.uuid}
                                href={article.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`group block p-3 rounded-lg border transition-all hover:shadow-md ${isDarkMode
                                    ? 'bg-gray-900/50 border-gray-700 hover:border-lime-500/50'
                                    : 'bg-gray-50 border-gray-100 hover:border-lime-300'
                                    }`}
                            >
                                <div className="flex gap-3">
                                    {article.image_url && (
                                        <img
                                            src={article.image_url}
                                            alt=""
                                            className="w-16 h-16 rounded-lg object-cover bg-gray-200 shrink-0"
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`text-sm font-medium leading-snug mb-1 line-clamp-2 group-hover:text-lime-500 transition-colors ${isDarkMode ? 'text-gray-200' : 'text-gray-900'
                                            }`}>
                                            {article.title}
                                        </h4>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded backdrop-blur-sm border transition-transform hover:scale-105 ${isDarkMode
                                                ? 'bg-gray-800/60 text-gray-400 border-gray-700/50'
                                                : 'bg-white/60 text-gray-500 border-gray-200/50'
                                                }`}>
                                                {article.source}
                                            </span>
                                            <span className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                {formatDate(article.published_at)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>

            <div className={`mt-4 pt-3 border-t text-center ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <p className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Powered by TheNewsAPI
                </p>
            </div>
        </div>
    );
}

// Fallback Data
function getMockNews(): NewsArticle[] {
    return [
        {
            uuid: "mock-1",
            title: "Western Corridor Freight Movement Sees 15% Spike",
            description: "Recent data shows increased activity in the Mumbai-Delhi industrial corridor.",
            url: "https://www.google.com/search?q=Western+Corridor+Freight+Movement+Traffic+Growth",
            image_url: "",
            source: "Logistics Weekly",
            published_at: new Date().toISOString()
        },
        {
            uuid: "mock-2",
            title: "New Smart Toll Plazas Operational on NH-48",
            description: "FASTag implementation reaches 98% efficiency reducing wait times.",
            url: "https://www.google.com/search?q=NH-48+Smart+Toll+Plazas+FASTag+update",
            image_url: "",
            source: "Transport Today",
            published_at: new Date().toISOString()
        },
        {
            uuid: "mock-3",
            title: "Jaipur Logistics Hub Expansion Approved",
            description: "Rajasthan government allocates land for new multi-modal logistics park.",
            url: "https://www.google.com/search?q=Jaipur+Multi-modal+Logistics+Park+Rajasthan+Government",
            image_url: "",
            source: "Business Standard",
            published_at: new Date(Date.now() - 86400000).toISOString()
        },
        {
            uuid: "mock-4",
            title: "Monsoon Preparedness for Highway Cargo",
            description: "Transport associations issue guidelines for safe trucking during rain.",
            url: "https://www.google.com/search?q=Highway+Trucking+Monsoon+Safety+Guidelines+India",
            image_url: "",
            source: "Transport Times",
            published_at: new Date(Date.now() - 172800000).toISOString()
        }
    ];
}
