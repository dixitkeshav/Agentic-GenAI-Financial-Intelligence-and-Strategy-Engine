const API_ENDPOINTS = {
    NEWS: '/api/fetch-news/',
    CHART_DATA: '/api/chart-data/',
    ANALYZE_SENTIMENT: '/api/analyze-sentiment/',
    CUSTOM_SENTIMENT: '/api/custom-sentiment/',
    SEARCH_TICKER: '/api/search-ticker/'
};

let sentimentChart = null;
let trendChart = null;

document.addEventListener("DOMContentLoaded", () => {
    fetchNews();
    loadChartData();

    const marketImpact = document.getElementById("market-impact");
    if (marketImpact) {
        marketImpact.textContent = "📊 Likely Bullish";
    }

    // Ticker autocomplete
    const tickerInput = document.getElementById("ticker-input");
    if (tickerInput) {
        tickerInput.addEventListener("input", handleTickerInput);
    }
});

async function fetchNews() {
    const newsFeed = document.getElementById("news-feed");
    if (!newsFeed) return;

    newsFeed.innerHTML = `<div id="loading-indicator" class="text-muted">🔄 Fetching news sentiment...</div>`;

    try {
        const response = await fetch(API_ENDPOINTS.NEWS);
        if (!response.ok) throw new Error(`⚠ Server error: ${response.status} ${response.statusText}`);

        const contentType = response.headers.get("content-type");
        if (!contentType?.includes("application/json")) throw new Error("⚠ Unexpected response format: not JSON.");

        const data = await response.json();
        if (!Array.isArray(data.articles)) throw new Error("⚠ Invalid data structure: 'articles' missing or not an array.");

        displayNews(data.articles);
    } catch (error) {
        console.error("Error fetching news:", error);
        newsFeed.innerHTML = `
            <p class="text-danger">❌ ${error.message}</p>
            <button class="btn btn-sm btn-outline-danger mt-2" onclick="fetchNews()">🔁 Retry</button>
        `;
    }
}

function displayNews(articles) {
    const newsFeed = document.getElementById("news-feed");
    if (!newsFeed) return;

    if (!articles.length) {
        newsFeed.innerHTML = "<p>No financial news available.</p>";
        return;
    }

    newsFeed.innerHTML = articles.map(article => {
        const sentiment = article.sentiment?.toLowerCase() || "neutral";
        const sentimentClass = `sentiment-${sentiment}`;
        const title = article.title || "Untitled Article";
        return `<p><strong>${title}</strong> - <span class="${sentimentClass}">${sentiment.toUpperCase()}</span></p>`;
    }).join("");
}

async function fetchCustomSentiment() {
    const tickerInput = document.getElementById("ticker-input");
    const sentimentResult = document.getElementById("custom-sentiment-result");

    if (!tickerInput || !sentimentResult) return;

    const ticker = tickerInput.value.trim().toUpperCase();
    if (!ticker) {
        sentimentResult.textContent = "Please enter a ticker symbol.";
        return;
    }

    try {
        const response = await fetch(API_ENDPOINTS.CUSTOM_SENTIMENT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticker })
        });

        if (!response.ok) throw new Error("Custom sentiment API failed.");

        const data = await response.json();
        const sentiment = data.sentiment?.toLowerCase();

        if (!sentiment) {
            sentimentResult.textContent = "Sentiment data not available.";
            return;
        }

        const { className, emoji } = getSentimentStyling(sentiment);

        sentimentResult.innerHTML = `${ticker} sentiment: <span class='${className}'>${sentiment}</span> ${emoji}`;
    } catch (error) {
        console.error("Error fetching custom sentiment:", error);
        sentimentResult.textContent = "An error occurred while fetching sentiment.";
    }
}

// --- Ticker Autocomplete ---
async function handleTickerInput(event) {
    const input = event.target;
    const dropdown = getOrCreateTickerDropdown(input);
    const query = input.value.trim().toUpperCase();

    if (!query) {
        dropdown.innerHTML = "";
        dropdown.style.display = "none";
        return;
    }

    try {
        const response = await fetch(`${API_ENDPOINTS.SEARCH_TICKER}?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Ticker search API failed.");
        const data = await response.json();
        const results = data.results || [];

        if (results.length === 0) {
            dropdown.innerHTML = "<div class='dropdown-item disabled'>No matches</div>";
        } else {
            dropdown.innerHTML = results.map(ticker =>
                `<div class='dropdown-item' onclick="selectTicker('${ticker}')">${ticker}</div>`
            ).join("");
        }
        dropdown.style.display = "block";
    } catch (error) {
        dropdown.innerHTML = "<div class='dropdown-item disabled'>Error fetching tickers</div>";
        dropdown.style.display = "block";
    }
}

function getOrCreateTickerDropdown(input) {
    let dropdown = document.getElementById("ticker-dropdown");
    if (!dropdown) {
        dropdown = document.createElement("div");
        dropdown.id = "ticker-dropdown";
        dropdown.className = "dropdown-menu show";
        dropdown.style.position = "absolute";
        dropdown.style.width = input.offsetWidth + "px";
        input.parentNode.appendChild(dropdown);
        input.setAttribute("autocomplete", "off");
        // Position dropdown below input
        dropdown.style.left = input.offsetLeft + "px";
        dropdown.style.top = (input.offsetTop + input.offsetHeight) + "px";
    }
    return dropdown;
}

window.selectTicker = function(ticker) {
    const tickerInput = document.getElementById("ticker-input");
    const dropdown = document.getElementById("ticker-dropdown");
    if (tickerInput) tickerInput.value = ticker;
    if (dropdown) {
        dropdown.innerHTML = "";
        dropdown.style.display = "none";
    }
};

async function analyzeNews() {
    const newsTextArea = document.getElementById("news-text");
    const resultDiv = document.getElementById("news-analysis-result");

    if (!newsTextArea || !resultDiv) return;

    const newsText = newsTextArea.value.trim();
    if (!newsText) {
        resultDiv.textContent = "Please enter some news text.";
        return;
    }

    try {
        const response = await fetch(API_ENDPOINTS.ANALYZE_SENTIMENT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: newsText })
        });

        if (!response.ok) throw new Error("Sentiment analysis API failed.");

        const data = await response.json();
        const sentiment = data.sentiment?.toLowerCase() || "neutral";

        const { className, emoji } = getSentimentStyling(sentiment);

        resultDiv.innerHTML = `AI Analysis: <span class='${className}'>${capitalize(sentiment)}</span> ${emoji}`;
    } catch (error) {
        console.error("Error analyzing sentiment:", error);
        resultDiv.textContent = "An error occurred while analyzing sentiment.";
    }
}

async function loadChartData() {
    try {
        const response = await fetch(API_ENDPOINTS.CHART_DATA);
        if (!response.ok) throw new Error("Chart API failed.");

        const chartData = await response.json();
        renderSentimentChart(chartData.distribution);
        renderTrendChart(chartData.trend);
    } catch (err) {
        console.error("Error loading charts:", err);
        if (sentimentChart) {
            sentimentChart.destroy();
            sentimentChart = null;
        }
        if (trendChart) {
            trendChart.destroy();
            trendChart = null;
        }
        const sentimentChartContainer = document.getElementById("sentimentChart");
        if (sentimentChartContainer) {
            sentimentChartContainer.parentNode.innerHTML = "<p>📉 Failed to load sentiment distribution chart.</p>";
        }
        const trendChartContainer = document.getElementById("trendChart");
        if (trendChartContainer) {
            trendChartContainer.parentNode.innerHTML = "<p>📉 Failed to load sentiment trends.</p>";
        }
    }
}

function renderSentimentChart(distribution = { labels: [], data: [] }) {
    const ctx = document.getElementById("sentimentChart")?.getContext("2d");
    if (!ctx) return;

    if (sentimentChart) sentimentChart.destroy();

    sentimentChart = new Chart(ctx, {
        type: "pie",
        data: {
            labels: distribution.labels,
            datasets: [{
                data: distribution.data,
                backgroundColor: ["#28a745", "#dc3545", "#ffc107"]
            }]
        }
    });
}

function renderTrendChart(trend = { labels: [], positive: [], negative: [] }) {
    const ctx = document.getElementById("trendChart")?.getContext("2d");
    if (!ctx) return;

    if (trendChart) trendChart.destroy();

    trendChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: trend.labels,
            datasets: [
                {
                    label: "Positive Sentiment",
                    data: trend.positive,
                    backgroundColor: "rgba(40, 167, 69, 0.5)",
                    borderColor: "#28a745",
                    fill: true
                },
                {
                    label: "Negative Sentiment",
                    data: trend.negative,
                    backgroundColor: "rgba(220, 53, 69, 0.5)",
                    borderColor: "#dc3545",
                    fill: true
                }
            ]
        }
    });
}

function refreshNews() {
    document.getElementById("news-feed").innerHTML = "<p>🔄 Refreshing news...</p>";
    fetchNews();
}

function getSentimentStyling(sentiment) {
    switch (sentiment) {
        case "positive":
            return { className: "sentiment-positive", emoji: "📈" };
        case "negative":
            return { className: "sentiment-negative", emoji: "📉" };
        default:
            return { className: "sentiment-neutral", emoji: "⚖️" };
    }
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}