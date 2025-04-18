// In script.js
const API_ENDPOINTS = {
    NEWS: '/api/fetch-news/',
    CHART_DATA: '/api/chart-data/'  // Changed to match your current URL
};

let currentChart = null;

async function fetchNews() {
    const newsFeed = document.getElementById("news-feed");
    newsFeed.innerHTML = `<div id="loading-indicator" class="text-muted">🔄 Fetching news sentiment...</div>`;

    try {
        const response = await fetch("/api/fetch-news/");

        if (!response.ok) {
            throw new Error(`⚠ Server error: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("⚠ Unexpected response format: not JSON.");
        }

        const data = await response.json();

        if (!data.articles || !Array.isArray(data.articles)) {
            throw new Error("⚠ Invalid data structure: 'articles' missing or not an array.");
        }

        displayNews(data.articles);

    } catch (error) {
        console.error("Error fetching news:", error);
        newsFeed.innerHTML = `
            <p class="text-danger">❌ ${error.message}</p>
            <button class="btn btn-sm btn-outline-danger mt-2" onclick="fetchNews()">🔁 Retry</button>
        `;
    }
}


let sentimentChart;  // global variable

function renderBarChart(data) {
    const ctx = document.getElementById('sentimentChart').getContext('2d');

    // ✅ Destroy existing chart if it exists
    if (sentimentChart) {
        sentimentChart.destroy();
    }

    // Create new chart
    sentimentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Sentiment',
                data: data.values,
                backgroundColor: 'rgba(75, 192, 192, 0.6)'
            }]
        },
        options: {
            responsive: true
        }
    });
}


async function loadChartData() {
    try {
        const response = await fetch("/api/chart-data/");
        if (!response.ok) throw new Error("Chart API failed.");

        const chartData = await response.json();

        // Chart 1: Sentiment Distribution
        const sentimentCtx = document.getElementById("sentimentChart").getContext("2d");
        new Chart(sentimentCtx, {
            type: "pie",
            data: {
                labels: chartData.distribution.labels,
                datasets: [{
                    data: chartData.distribution.data,
                    backgroundColor: ["#28a745", "#dc3545", "#ffc107"]
                }]
            }
        });

        // Chart 2: Sentiment Trend Over Time
        const trendCtx = document.getElementById("trendChart").getContext("2d");
        new Chart(trendCtx, {
            type: "line",
            data: {
                labels: chartData.trend.labels,
                datasets: [
                    {
                        label: "Positive Sentiment",
                        data: chartData.trend.positive,
                        backgroundColor: "rgba(40, 167, 69, 0.5)",
                        borderColor: "#28a745",
                        fill: true
                    },
                    {
                        label: "Negative Sentiment",
                        data: chartData.trend.negative,
                        backgroundColor: "rgba(220, 53, 69, 0.5)",
                        borderColor: "#dc3545",
                        fill: true
                    }
                ]
            }
        });

    } catch (err) {
        console.error("Error loading charts:", err);
        document.getElementById("sentimentChart").outerHTML = "<p>📉 Failed to load sentiment distribution chart.</p>";
        document.getElementById("trendChart").outerHTML = "<p>📉 Failed to load sentiment trends.</p>";
    }
}

// Function to display news
function displayNews(articles) {
    const newsFeed = document.getElementById("news-feed");
    newsFeed.innerHTML = "";  // Clear previous news

    if (!articles || articles.length === 0) {
        newsFeed.innerHTML = "<p>No financial news available.</p>";
        return;
    }

    articles.forEach(article => {
        const sentimentClass = `sentiment-${article.sentiment}`;
        newsFeed.innerHTML += `
            <p><strong>${article.title}</strong> - 
               <span class="${sentimentClass}">${article.sentiment.toUpperCase()}</span>
            </p>
        `;
    });
}

// Market Sentiment Mock
function fetchCustomSentiment() {
    const ticker = document.getElementById("ticker-input").value.toUpperCase();
    const sentimentResult = document.getElementById("custom-sentiment-result");

    if (ticker === "AAPL") {
        sentimentResult.innerHTML = "Apple's sentiment: <span class='sentiment-positive'>Positive</span> 📈";
    } else {
        sentimentResult.innerHTML = "Sentiment data not available.";
    }
}

// AI-Powered News Sentiment Analysis (Mock)
async function analyzeNews() {
    const newsText = document.getElementById("news-text").value.trim(); // Get news input

    if (!newsText) {
        document.getElementById("news-analysis-result").innerHTML = "Please enter some news text.";
        return;
    }

    try {
        const response = await fetch("/api/analyze-sentiment/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: newsText })
        });

        if (!response.ok) {
            throw new Error("Sentiment analysis API failed.");
        }

        const data = await response.json();
        const sentiment = data.sentiment.toLowerCase();

        let sentimentClass = "";
        let emoji = "";

        if (sentiment === "positive") {
            sentimentClass = "sentiment-positive";
            emoji = "🚀";
        } else if (sentiment === "negative") {
            sentimentClass = "sentiment-negative";
            emoji = "📉";
        } else {
            sentimentClass = "sentiment-neutral";
            emoji = "⚖️";
        }

        document.getElementById("news-analysis-result").innerHTML =
            `AI Analysis: <span class='${sentimentClass}'>${sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}</span> ${emoji}`;
    } catch (error) {
        console.error("Error analyzing sentiment:", error);
        document.getElementById("news-analysis-result").innerHTML = "An error occurred while analyzing sentiment.";
    }
}


// Refresh news manually
function refreshNews() {
    document.getElementById("news-feed").innerHTML = "<p>🔄 Refreshing news...</p>";
    fetchNews();
}

// Chart.js Sentiment Distribution
function renderSentimentChart() {
    const sentimentData = {
        labels: ["Positive", "Negative", "Neutral"],
        datasets: [{
            data: [50, 30, 20],  // Replace with real data later
            backgroundColor: ["#28a745", "#dc3545", "#ffc107"]
        }]
    };

    const ctx = document.getElementById("sentimentChart").getContext("2d");
    new Chart(ctx, {
        type: "pie",
        data: sentimentData,
    });
}

// Sentiment Trends Over Time
function renderTrendChart() {
    const trendData = {
        labels: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"],
        datasets: [
            {
                label: "Positive Sentiment",
                data: [60, 70, 65, 75, 80],
                backgroundColor: "rgba(40, 167, 69, 0.5)",
                borderColor: "#28a745",
                fill: true
            },
            {
                label: "Negative Sentiment",
                data: [30, 20, 25, 15, 10],
                backgroundColor: "rgba(220, 53, 69, 0.5)",
                borderColor: "#dc3545",
                fill: true
            }
        ]
    };

    const trendCtx = document.getElementById("trendChart").getContext("2d");
    new Chart(trendCtx, {
        type: "line",
        data: trendData,
    });
}

// Unified initialization
document.addEventListener("DOMContentLoaded", function () {
    fetchNews();
    renderSentimentChart();
    renderTrendChart();
    loadChartData();
    document.getElementById("market-impact").innerHTML = "📊 Likely Bullish";
});
