#property strict
#property version "1.10"
#property description "Read-only DAYRIS closed-position exporter. No trading or network functions."
input int RefreshSeconds=30;
string Clean(string s) { StringReplace(s,";","_"); StringReplace(s,"\r"," "); StringReplace(s,"\n"," "); return s; }
int OnInit() { EventSetTimer(MathMax(10,RefreshSeconds)); Export(); return INIT_SUCCEEDED; }
void OnDeinit(const int reason) { EventKillTimer(); }
void OnTick() {}
void OnTimer() { Export(); }
void Export() {
  if(!TerminalInfoInteger(TERMINAL_CONNECTED) || AccountInfoInteger(ACCOUNT_LOGIN)==0) return;
  if(!HistorySelect(0,TimeCurrent())) return;
  ulong ids[]; int count=0;
  for(int i=0;i<HistoryDealsTotal();i++) {
    ulong ticket=HistoryDealGetTicket(i);
    long type=HistoryDealGetInteger(ticket,DEAL_TYPE);
    if(type!=DEAL_TYPE_BUY && type!=DEAL_TYPE_SELL) continue;
    ulong id=(ulong)HistoryDealGetInteger(ticket,DEAL_POSITION_ID);
    bool seen=false; for(int j=0;j<count;j++) if(ids[j]==id) { seen=true; break; }
    if(!seen && id>0) { ArrayResize(ids,count+1); ids[count++]=id; }
  }
  string server=Clean(AccountInfoString(ACCOUNT_SERVER));
  uint hash=2166136261; for(int k=0;k<StringLen(server);k++) hash=(hash^(uint)StringGetCharacter(server,k))*16777619;
  string file="DAYRIS\\dayris-mt5-"+(string)AccountInfoInteger(ACCOUNT_LOGIN)+"-"+(string)hash+".csv";
  string temp=file+".tmp";
  int f=FileOpen(temp,FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON,';',CP_UTF8);
  if(f==INVALID_HANDLE) return;
  FileWrite(f,"platform","server","account","ticket","date","time","symbol","direction","profit","swap","commission","currency");
  long mode=AccountInfoInteger(ACCOUNT_TRADE_MODE);
  string label=(mode==ACCOUNT_TRADE_MODE_REAL ? "Live" : mode==ACCOUNT_TRADE_MODE_CONTEST ? "Contest" : "Demo");
  string updated=TimeToString(TimeCurrent(),TIME_DATE|TIME_SECONDS); StringReplace(updated,".","-");
  FileWrite(f,"ACCOUNT","MT5",server,(string)AccountInfoInteger(ACCOUNT_LOGIN),Clean(AccountInfoString(ACCOUNT_COMPANY)),label,DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE),8),AccountInfoString(ACCOUNT_CURRENCY),updated);
  for(int j=0;j<count;j++) {
    if(!HistorySelectByPosition(ids[j])) { FileClose(f); return; }
    double netVolume=0,profit=0,swap=0,commission=0; datetime last=0,first=0;
    string symbol="",side="";
    for(int i=0;i<HistoryDealsTotal();i++) {
      ulong ticket=HistoryDealGetTicket(i); long type=HistoryDealGetInteger(ticket,DEAL_TYPE);
      datetime when=(datetime)HistoryDealGetInteger(ticket,DEAL_TIME);
      profit+=HistoryDealGetDouble(ticket,DEAL_PROFIT);
      swap+=HistoryDealGetDouble(ticket,DEAL_SWAP);
      commission+=HistoryDealGetDouble(ticket,DEAL_COMMISSION)+HistoryDealGetDouble(ticket,DEAL_FEE);
      if(type!=DEAL_TYPE_BUY && type!=DEAL_TYPE_SELL) continue;
      netVolume+=(type==DEAL_TYPE_BUY ? 1 : -1)*HistoryDealGetDouble(ticket,DEAL_VOLUME);
      if(first==0 || when<first) { first=when; symbol=HistoryDealGetString(ticket,DEAL_SYMBOL); side=(type==DEAL_TYPE_BUY ? "buy" : "sell"); }
      if(when>last) last=when;
    }
    // Partial closes and open positions are exported only once fully closed.
    // All entry/exit fees are included in the completed position result.
    if(first==0 || MathAbs(netVolume)>0.0000001) continue;
    string date=TimeToString(last,TIME_DATE); StringReplace(date,".","-");
    FileWrite(f,"MT5",server,(string)AccountInfoInteger(ACCOUNT_LOGIN),(string)ids[j],date,TimeToString(last,TIME_SECONDS),Clean(symbol),side,DoubleToString(profit,8),DoubleToString(swap,8),DoubleToString(commission,8),AccountInfoString(ACCOUNT_CURRENCY));
  }
  FileWrite(f,"END"); FileFlush(f); FileClose(f);
  if(!FileMove(temp,FILE_COMMON,file,FILE_COMMON|FILE_REWRITE)) Print("DAYRIS export publish failed: ",GetLastError());
}
