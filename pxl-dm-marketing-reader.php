<?php
declare(strict_types=1);
$root=getenv('PXL_MARKETING_APP_ROOT') ?: '/var/www/marketing.pixelsolusindo.com';
$period=$argv[1] ?? '';
if(!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/',$period)){fwrite(STDERR,"Invalid period\n");exit(2);}
require $root.'/vendor/autoload.php';
$app=require $root.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$db=Illuminate\Support\Facades\DB::connection();
$start=$period.'-01';
$end=(new DateTimeImmutable($start))->modify('last day of this month')->format('Y-m-d');
try{
  // Hard safety boundary: MySQL rejects DML for this transaction.
  $db->statement('START TRANSACTION READ ONLY');
  $kpi=$db->select('SELECT period,category,metric_name,metric_value,metric_unit,notes FROM kpi_records WHERE period>=? AND period<=? ORDER BY category,metric_name',[$start,$end]);
  $targets=$db->select('SELECT category,metric_name,target_value,effective_from,effective_until FROM kpi_targets WHERE effective_from<=? AND (effective_until IS NULL OR effective_until>=?) ORDER BY category,metric_name',[$end,$start]);
  $meta=$db->select('SELECT period,campaign_name,spend,reach,impressions,clicks,leads,revenue,notes,weekly_data FROM meta_ad_campaigns WHERE period>=? AND period<=? ORDER BY campaign_name',[$start,$end]);
  $prospects=$db->select('SELECT period,total_prospek,total_deal,total_nego,total_lose FROM prospect_summaries WHERE period>=? AND period<=? ORDER BY period',[$start,$end]);
  $db->statement('ROLLBACK');
}catch(Throwable $e){try{$db->statement('ROLLBACK');}catch(Throwable $ignore){} fwrite(STDERR,$e->getMessage()."\n");exit(3);}
$sum=['spend'=>0.0,'reach'=>0,'impressions'=>0,'clicks'=>0,'leads'=>0,'revenue'=>0.0];
foreach($meta as $r){$sum['spend']+=(float)$r->spend;$sum['reach']+=(int)$r->reach;$sum['impressions']+=(int)$r->impressions;$sum['clicks']+=(int)$r->clicks;$sum['leads']+=(int)$r->leads;$sum['revenue']+=(float)$r->revenue;}
$sum['ctr']=$sum['impressions']?($sum['clicks']/$sum['impressions']*100):0;
$sum['cpc']=$sum['clicks']?($sum['spend']/$sum['clicks']):0;
$sum['cpm']=$sum['impressions']?($sum['spend']/$sum['impressions']*1000):0;
$sum['cpl']=$sum['leads']?($sum['spend']/$sum['leads']):0;
$sum['roas']=$sum['spend']?($sum['revenue']/$sum['spend']):0;
$pros=['total_prospek'=>0,'total_deal'=>0,'total_nego'=>0,'total_lose'=>0];foreach($prospects as $r){foreach(array_keys($pros) as $k)$pros[$k]+=(int)$r->$k;}
$kpiMap=[];foreach($kpi as $r){$kpiMap[$r->category.'.'.$r->metric_name]=['value'=>(float)$r->metric_value,'unit'=>$r->metric_unit];}
$targetMap=[];foreach($targets as $r){$targetMap[$r->category.'.'.$r->metric_name]=(float)$r->target_value;}
$out=['period'=>$period,'source'=>'Marketing Apps','read_only'=>true,'payload'=>['kpi_records'=>$kpi,'kpi_targets'=>$targets,'meta_ad_campaigns'=>$meta,'prospect_summaries'=>$prospects],'summary'=>['kpi'=>$kpiMap,'targets'=>$targetMap,'meta_ads'=>$sum,'prospect'=>$pros]];
echo json_encode($out,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
