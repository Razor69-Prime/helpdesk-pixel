'use strict';
// PXL-URG-0124 — WO mobile action grid. CSS-only server-side injection.
function patchWoMobileGrid(html){
  let src=String(html||'');
  if(src.includes('PXL-URG-0124 — WO mobile action grid')) return src;
  const css=`\n<style id="pxl-urg-0124-wo-mobile-grid">\n/* PXL-URG-0124 — WO mobile action grid */\n@media (max-width: 600px){\n  #tab-tickets .ticket-header{display:block!important}\n  #tab-tickets .ticket-header>div:first-child{min-width:0!important;width:100%!important}\n  #tab-tickets .ticket-actions{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:6px!important;width:100%!important;max-width:none!important;margin-top:10px!important;align-items:stretch!important;position:static!important;overflow:visible!important}\n  #tab-tickets .ticket-actions .status-select{grid-column:1/-1!important;width:100%!important;max-width:none!important;min-width:0!important;height:36px!important}\n  #tab-tickets .ticket-actions .btn{width:100%!important;min-width:0!important;max-width:none!important;justify-content:center!important;padding:7px 5px!important;font-size:10.5px!important;line-height:1.15!important;overflow:hidden!important;text-overflow:ellipsis!important}\n  #tab-tickets .ticket-actions .btn span{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important}\n}\n</style>\n`;
  if(src.includes('</head>')) return src.replace('</head>',css+'</head>');
  return css+src;
}
module.exports={patchWoMobileGrid};
