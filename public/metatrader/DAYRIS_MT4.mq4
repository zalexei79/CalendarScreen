#property strict
#property version "1.00"
#property description "Read-only DAYRIS closed-order exporter. No trading or network functions."
input int RefreshSeconds=30;
string Clean(string s) { StringReplace(s,";","_"); StringReplace(s,"\r"," "); StringReplace(s,"\n"," "); return s; }
int OnInit() { EventSetTimer(MathMax(10,RefreshSeconds)); Export(); return INIT_SUCCEEDED; }
void OnDeinit(const int reason) { EventKillTimer(); }
void OnTick() {}
void OnTimer() { Export(); }
void Export() {
  if(!IsConnected() || AccountNumber()==0) return;
  string server=Clean(AccountServer());
  uint hash=2166136261; for(int k=0;k<StringLen(server);k++) hash=(hash^(uint)StringGetCharacter(server,k))*16777619;
  string file="DAYRIS\\dayris-mt4-"+(string)AccountNumber()+"-"+(string)hash+".csv";
  string temp=file+".tmp";
  int f=FileOpen(temp,FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON,';',CP_UTF8);
  if(f==INVALID_HANDLE) return;
  FileWrite(f,"platform","server","account","ticket","date","time","symbol","direction","profit","swap","commission","currency");
  for(int i=0;i<OrdersHistoryTotal();i++) {
    if(!OrderSelect(i,SELECT_BY_POS,MODE_HISTORY)) { FileClose(f); return; }
    if((OrderType()!=OP_BUY && OrderType()!=OP_SELL) || OrderCloseTime()==0) continue;
    string date=TimeToString(OrderCloseTime(),TIME_DATE); StringReplace(date,".","-");
    FileWrite(f,"MT4",server,(string)AccountNumber(),(string)OrderTicket(),date,TimeToString(OrderCloseTime(),TIME_SECONDS),Clean(OrderSymbol()),OrderType()==OP_BUY ? "buy" : "sell",DoubleToString(OrderProfit(),8),DoubleToString(OrderSwap(),8),DoubleToString(OrderCommission(),8),AccountCurrency());
  }
  FileWrite(f,"END"); FileFlush(f); FileClose(f);
  if(!FileMove(temp,FILE_COMMON,file,FILE_COMMON|FILE_REWRITE)) Print("DAYRIS export publish failed: ",GetLastError());
}
