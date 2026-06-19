//+------------------------------------------------------------------+
//|                                          FTMO_EquityGuardian.mq5  |
//|  Defensive risk-guard EA. Monitors account equity and FLATTENS    |
//|  all trades + blocks further exposure BEFORE you breach an FTMO    |
//|  daily-loss or max-total-loss limit.                              |
//|                                                                    |
//|  Run it on ONE chart alongside your trading EA. It places NO       |
//|  trades of its own - it only protects you from rule breaches.      |
//|                                                                    |
//|  *** Verify current FTMO limits at ftmo.com. Defaults use a        |
//|  buffer (4% daily / 8% total) UNDER the typical 5% / 10% rules. ***|
//+------------------------------------------------------------------+
#property copyright "POStrategicEA toolkit"
#property version   "1.00"
#property strict

#include <Trade/Trade.mqh>
CTrade trade;

//--- inputs
input double DailyLossLimitPercent = 4.0;   // Daily loss cap % (buffer under FTMO 5%)
input double MaxTotalLossPercent   = 8.0;   // Total loss cap % (buffer under FTMO 10%)
input double InitialBalance        = 0.0;   // Challenge start balance (0 = auto-detect)
input long   MagicFilter           = 0;     // 0 = act on ALL positions; else only this magic
input bool   ClosePositions        = true;  // Close open positions on breach
input bool   DeletePendings        = true;  // Delete pending orders on breach
input bool   EnforceWhileBlocked   = true;  // Keep flattening if EA re-opens after breach
input bool   SendAlerts            = true;  // Terminal alert on breach
input bool   SendPush              = false; // Push notification on breach
input int    TimerSeconds          = 5;     // Re-check interval (covers quiet ticks)

//--- state
double   g_dayBaseline   = 0.0;   // higher of balance/equity at day start (FTMO method)
datetime g_dayStart      = 0;
double   g_initialBalance= 0.0;
bool     g_dailyBlocked  = false;
bool     g_totalBlocked  = false;

//+------------------------------------------------------------------+
int OnInit()
{
   g_initialBalance = (InitialBalance > 0.0) ? InitialBalance
                                             : AccountInfoDouble(ACCOUNT_BALANCE);
   ResetDailyBaseline();
   EventSetTimer(TimerSeconds < 1 ? 1 : TimerSeconds);
   Print("FTMO Guardian active. InitialBalance=", DoubleToString(g_initialBalance,2),
         "  DailyCap=", DailyLossLimitPercent, "%  TotalCap=", MaxTotalLossPercent, "%");
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   Comment("");
}

void OnTick()  { CheckGuards(); }
void OnTimer() { CheckGuards(); }

//+------------------------------------------------------------------+
datetime DayStart(datetime t)
{
   MqlDateTime s; TimeToStruct(t, s);
   s.hour = 0; s.min = 0; s.sec = 0;
   return(StructToTime(s));
}

void ResetDailyBaseline()
{
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double eq  = AccountInfoDouble(ACCOUNT_EQUITY);
   g_dayBaseline  = MathMax(bal, eq);          // FTMO: higher of balance/equity at day open
   g_dayStart     = DayStart(TimeCurrent());
   g_dailyBlocked = false;
}

//+------------------------------------------------------------------+
void CheckGuards()
{
   // roll the daily baseline at a new server day
   if(DayStart(TimeCurrent()) != g_dayStart)
      ResetDailyBaseline();

   double eq          = AccountInfoDouble(ACCOUNT_EQUITY);
   double totalFloor  = g_initialBalance * (1.0 - MaxTotalLossPercent / 100.0);
   double dailyFloor  = g_dayBaseline    * (1.0 - DailyLossLimitPercent / 100.0);

   // ---- max total loss (permanent for the challenge) ----
   if(!g_totalBlocked && eq <= totalFloor)
   {
      g_totalBlocked = true;
      Breach("MAX TOTAL LOSS", eq, totalFloor);
   }

   // ---- daily loss ----
   if(!g_dailyBlocked && eq <= dailyFloor)
   {
      g_dailyBlocked = true;
      Breach("DAILY LOSS", eq, dailyFloor);
   }

   // ---- keep enforcing if the trading EA re-opens after a breach ----
   if(EnforceWhileBlocked && (g_dailyBlocked || g_totalBlocked))
   {
      if(DeletePendings) DeleteAllPendings();
      if(ClosePositions) CloseAllPositions();
   }

   UpdateDashboard(eq, dailyFloor, totalFloor);
}

//+------------------------------------------------------------------+
void Breach(string which, double eq, double floor)
{
   string msg = StringFormat("FTMO Guardian: %s hit. Equity=%.2f Floor=%.2f -> flattening & blocking.",
                             which, eq, floor);
   Print(msg);
   if(SendAlerts) Alert(msg);
   if(SendPush)   SendNotification(msg);
   if(DeletePendings) DeleteAllPendings();
   if(ClosePositions) CloseAllPositions();
}

//+------------------------------------------------------------------+
void CloseAllPositions()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(MagicFilter != 0 && PositionGetInteger(POSITION_MAGIC) != MagicFilter) continue;
      trade.PositionClose(ticket);
   }
}

void DeleteAllPendings()
{
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0) continue;
      if(MagicFilter != 0 && OrderGetInteger(ORDER_MAGIC) != MagicFilter) continue;
      trade.OrderDelete(ticket);
   }
}

//+------------------------------------------------------------------+
void UpdateDashboard(double eq, double dailyFloor, double totalFloor)
{
   double dailyUsed = (g_dayBaseline   - eq) / g_dayBaseline    * 100.0;
   double totalUsed = (g_initialBalance- eq) / g_initialBalance * 100.0;
   string status = (g_totalBlocked ? "TOTAL-LOCKED" :
                   (g_dailyBlocked ? "DAILY-LOCKED" : "OK"));
   Comment(StringFormat(
      "FTMO Guardian [%s]\nEquity: %.2f\nDaily loss: %.2f%% / %.1f%% cap\nTotal loss: %.2f%% / %.1f%% cap",
      status, eq, MathMax(0,dailyUsed), DailyLossLimitPercent,
      MathMax(0,totalUsed), MaxTotalLossPercent));
}
//+------------------------------------------------------------------+
