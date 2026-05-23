-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "OHLCVCandle" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" BIGINT NOT NULL DEFAULT 0,
    "oi" BIGINT,

    CONSTRAINT "OHLCVCandle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION,
    "narrative" JSONB,
    "snapshot" JSONB NOT NULL,
    "candleTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestRun" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "paramsJson" JSONB,
    "summaryJson" JSONB NOT NULL,
    "equityCurveJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestTrade" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "direction" TEXT NOT NULL,
    "entry" DOUBLE PRECISION NOT NULL,
    "exitPrice" DOUBLE PRECISION,
    "pnlPct" DOUBLE PRECISION,
    "outcome" TEXT,
    "candleTime" TIMESTAMP(3),
    "metaJson" JSONB,

    CONSTRAINT "BacktestTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistSymbol" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WatchlistSymbol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "broker" TEXT NOT NULL DEFAULT 'zerodha',
    "signalSensitivity" TEXT NOT NULL DEFAULT 'balanced',
    "enabledIndicators" JSONB NOT NULL,
    "watchlist" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionLog" (
    "id" TEXT NOT NULL,
    "broker" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "profile" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OHLCVCandle_symbol_interval_time_idx" ON "OHLCVCandle"("symbol", "interval", "time");

-- CreateIndex
CREATE UNIQUE INDEX "OHLCVCandle_symbol_interval_time_key" ON "OHLCVCandle"("symbol", "interval", "time");

-- CreateIndex
CREATE INDEX "Signal_symbol_idx" ON "Signal"("symbol");

-- CreateIndex
CREATE INDEX "Signal_createdAt_idx" ON "Signal"("createdAt");

-- CreateIndex
CREATE INDEX "BacktestRun_symbol_idx" ON "BacktestRun"("symbol");

-- CreateIndex
CREATE INDEX "BacktestRun_createdAt_idx" ON "BacktestRun"("createdAt");

-- CreateIndex
CREATE INDEX "BacktestTrade_runId_idx" ON "BacktestTrade"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistSymbol_symbol_key" ON "WatchlistSymbol"("symbol");

-- AddForeignKey
ALTER TABLE "BacktestTrade" ADD CONSTRAINT "BacktestTrade_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BacktestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

