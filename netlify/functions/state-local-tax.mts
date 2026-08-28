const labels=["Lowest 20%","Second 20%","Middle 20%","Fourth 20%","Next 15%","Next 4%","Top 1%"];

const clean = (html:string) => html
  .replace(/<script[\s\S]*?<\/script>/gi," ")
  .replace(/<style[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," ")
  .replace(/&nbsp;|&#160;/gi," ")
  .replace(/&amp;/gi,"&")
  .replace(/&#8211;|&ndash;/gi,"-")
  .replace(/&#8212;|&mdash;/gi,"-")
  .replace(/&#8217;|&rsquo;/gi,"'")
  .replace(/\s+/g," ")
  .trim();

const nums = (s:string) => [...s.matchAll(/-?\d+(?:\.\d+)?%/g)].map(m=>Number(m[0].replace("%","")));

function section(text:string,start:string,end:string){
  const a=text.indexOf(start);
  if(a<0)return "";
  const b=end?text.indexOf(end,a+start.length):-1;
  return text.slice(a,b>a?b:undefined);
}

function profile(text:string){
  const ranges=section(text,"Income Range","Average Income in Group");
  const dollars=[...ranges.matchAll(/\$([\d,]+)/g)].map(m=>Number(m[1].replace(/,/g,"")));
  const boundaries=[...new Set(dollars)].slice(0,6);
  const total=nums(section(text,"TOTAL TAXES","Individual figures")).slice(0,7);
  const sales=nums(section(text,"Sales & Excise Taxes","General Sales")).slice(0,7);
  const property=nums(section(text,"Property Taxes","Home, Rent")).slice(0,7);
  const income=nums(section(text,"Income Taxes","Personal Income")).slice(0,7);
  const other=nums(section(text,"Other Taxes","TOTAL TAXES")).slice(0,7);
  if(boundaries.length!==6||total.length!==7)throw new Error("Could not parse ITEP profile");
  return {boundaries,total,sales,property,income,other};
}

export default async (request:Request) => {
  const url=new URL(request.url);
  const zip=(url.searchParams.get("zip")||"").trim();
  if(!/^\d{5}$/.test(zip))return Response.json({error:"A five-digit ZIP code is required."},{status:400});
  try{
    const z=await fetch("https://api.zippopotam.us/us/"+zip,{headers:{"Accept":"application/json"},signal:AbortSignal.timeout(8000)});
    if(!z.ok)return Response.json({error:"ZIP code not found."},{status:404});
    const zp=await z.json();
    const place=zp?.places?.[0];
    const state=place?.state;
    const abbr=place?.["state abbreviation"];
    const city=place?.["place name"];
    if(!state)throw new Error("No state for ZIP");
    const slug=state.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    const urls=[
      "https://itep.org/"+slug+"-who-pays-7th-edition/",
      "https://itep.org/whopays/"+slug+"-who-pays-7th-edition/"
    ];
    let html="";
    let sourceUrl="";
    for(const u of urls){
      const r=await fetch(u,{headers:{"Accept":"text/html","User-Agent":"WFCCI/1.0"},signal:AbortSignal.timeout(10000)});
      if(r.ok){html=await r.text();sourceUrl=u;break}
    }
    if(!html)throw new Error("ITEP profile unavailable");
    const data=profile(clean(html));
    return Response.json({zip,city,state,abbr,sourceUrl,...data},{
      headers:{"Cache-Control":"public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"}
    });
  }catch{
    return Response.json({error:"Localized state/local tax data is temporarily unavailable."},{status:502});
  }
};

export const config={path:"/api/state-local-tax"};
