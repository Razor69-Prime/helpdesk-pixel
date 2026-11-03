<?php
declare(strict_types=1);

use App\Services\CustomerDealRevenue;
use App\Services\CustomerPaymentRevenue;
use App\Services\KpiService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

$root=getenv('PXL_MARKETING_APP_ROOT') ?: '/var/www/marketing.pixelsolusindo.com';
$period=$argv[1] ?? '';
if(!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/',$period)){fwrite(STDERR,"Invalid period\n");exit(2);}

require $root.'/vendor/autoload.php';
$app=require $root.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$db=DB::connection();
$selected=Carbon::parse($period.'-01')->startOfMonth();
$previous=$selected->copy()->subMonth();
$start=$selected->toDateString();
$end=$selected->copy()->endOfMonth()->toDateString();

try{
  // HARD SAFETY BOUNDARY: MySQL rejects any DML/DDL in this transaction.
  $db->statement('START TRANSACTION READ ONLY');

  /** @var KpiService $kpiService */
  $kpiService=app(KpiService::class);
  /** @var CustomerDealRevenue $dealRevenueService */
  $dealRevenueService=app(CustomerDealRevenue::class);
  /** @var CustomerPaymentRevenue $paymentRevenueService */
  $paymentRevenueService=app(CustomerPaymentRevenue::class);

  // Keep raw source rows for auditability; SELECT only.
  $kpi=$db->select('SELECT period,category,metric_name,metric_value,metric_unit,notes FROM kpi_records WHERE period>=? AND period<=? ORDER BY category,metric_name',[$start,$end]);
  $targets=$db->select('SELECT category,metric_name,target_value,effective_from,effective_until FROM kpi_targets WHERE effective_from<=? AND (effective_until IS NULL OR effective_until>=?) ORDER BY effective_from DESC,category,metric_name',[$end,$start]);
  $meta=$db->select('SELECT period,campaign_name,spend,reach,impressions,clicks,leads,revenue,notes,weekly_data FROM meta_ad_campaigns WHERE period>=? AND period<=? ORDER BY campaign_name',[$start,$end]);
  $prospects=$db->select('SELECT period,total_prospek,total_deal,total_nego,total_lose FROM prospect_summaries WHERE period>=? AND period<=? ORDER BY period',[$start,$end]);

  // Mirror the exact business logic used by Marketing Apps dashboard.
  $categories=$kpiService->getMonthlyDataByCategory($start);
  $comparison=$kpiService->compareMonths($start,$previous->toDateString());
  $website=$kpiService->getWebsiteAnalyticsSummary($start);
  $adsAgg=$kpiService->adsAggregates($start);
  $featuredKeys=array_keys(array_filter(config('kpi.categories'),fn($cat)=>$cat['featured'] ?? true));
  $targetAchievement=collect($kpiService->checkTargetAchievement($start))
    ->filter(fn($row)=>in_array($row['category'],$featuredKeys,true))
    ->values();

  $dealRevenue=(float)$dealRevenueService->totalForPeriod($selected);
  $cashIn=(float)$paymentRevenueService->totalForPeriod($selected);
  $outstandingRows=$paymentRevenueService->outstandingAsOf($selected);
  $outstanding=(float)$outstandingRows->sum('remaining');

  // Campaign totals needed for dashboard/reports beyond the six featured Ads KPI.
  $campaign=['spend'=>0.0,'reach'=>0,'impressions'=>0,'clicks'=>0,'leads'=>0];
  foreach($meta as $r){
    $campaign['spend']+=(float)$r->spend;
    $campaign['reach']+=(int)$r->reach;
    $campaign['impressions']+=(int)$r->impressions;
    $campaign['clicks']+=(int)$r->clicks;
    $campaign['leads']+=(int)$r->leads;
  }
  $campaign['ctr']=$campaign['impressions']?round($campaign['clicks']/$campaign['impressions']*100,2):null;
  $campaign['cpc']=$campaign['clicks']?round($campaign['spend']/$campaign['clicks'],2):null;
  $campaign['cpm']=$campaign['impressions']?round($campaign['spend']/$campaign['impressions']*1000,2):null;
  $campaign['cpl']=$campaign['leads']?round($campaign['spend']/$campaign['leads'],2):null;

  $pros=['total_prospek'=>0,'total_deal'=>0,'total_nego'=>0,'total_lose'=>0];
  foreach($prospects as $r){foreach(array_keys($pros) as $key)$pros[$key]+=(int)$r->$key;}

  // Backward-compatible flat KPI/target maps for existing consumers.
  $kpiMap=[];
  foreach($kpi as $r){$kpiMap[$r->category.'.'.$r->metric_name]=['value'=>(float)$r->metric_value,'unit'=>$r->metric_unit];}
  $targetMap=[];
  foreach($targets as $r){$targetMap[$r->category.'.'.$r->metric_name]=(float)$r->target_value;}

  $targetTotal=$targetAchievement->count();
  $targetAchieved=$targetAchievement->where('achieved',true)->count();
  $metaAds=[
    'spend'=>(float)($adsAgg['ad_spend'] ?? $campaign['spend']),
    'reach'=>$campaign['reach'],
    'impressions'=>$campaign['impressions'],
    'clicks'=>$campaign['clicks'],
    'leads'=>(int)($adsAgg['conversions'] ?? $campaign['leads']),
    'conversions'=>(int)($adsAgg['conversions'] ?? $campaign['leads']),
    'ctr'=>$adsAgg['ctr'] ?? $campaign['ctr'],
    'cpc'=>$adsAgg['cpc'] ?? $campaign['cpc'],
    'cpm'=>$adsAgg['cpm'] ?? $campaign['cpm'],
    'cpl'=>$campaign['cpl'],
    'deal_revenue'=>$dealRevenue,
    'revenue'=>$dealRevenue,
    'cash_in'=>$cashIn,
    'outstanding'=>$outstanding,
    'profit'=>$dealRevenue-(float)($adsAgg['ad_spend'] ?? $campaign['spend']),
    'roas'=>$adsAgg['roas'] ?? null,
  ];

  $out=[
    'period'=>$period,
    'source'=>'Marketing Apps',
    'read_only'=>true,
    'payload'=>[
      'kpi_records'=>$kpi,
      'kpi_targets'=>$targets,
      'meta_ad_campaigns'=>$meta,
      'prospect_summaries'=>$prospects,
    ],
    'summary'=>[
      'kpi'=>$kpiMap,
      'targets'=>$targetMap,
      'categories'=>$categories,
      'comparison'=>$comparison,
      'website'=>$website,
      'target_achievement'=>$targetAchievement->all(),
      'target_summary'=>[
        'total'=>$targetTotal,
        'achieved'=>$targetAchieved,
        'achievement_rate'=>$targetTotal?round($targetAchieved/$targetTotal*100,2):0,
      ],
      'meta_ads'=>$metaAds,
      'prospect'=>$pros,
    ],
  ];

  $db->statement('ROLLBACK');
}catch(Throwable $e){
  try{$db->statement('ROLLBACK');}catch(Throwable $ignore){}
  fwrite(STDERR,$e->getMessage()."\n");
  exit(3);
}

echo json_encode($out,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
