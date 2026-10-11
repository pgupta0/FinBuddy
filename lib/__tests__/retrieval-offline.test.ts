import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(()=>({ search:vi.fn(), fetch:vi.fn(), rerank:vi.fn(), events:[] as string[] }));
vi.mock("@pinecone-database/pinecone",()=>({Pinecone:class {
  inference={rerank: (...args:unknown[])=>{mock.events.push("rerank");return mock.rerank(...args);}};
  Index(){return { namespace:(ns:string)=>({searchRecords:(arg:unknown)=>mock.search(ns,arg),fetch:(ids:string[])=>{mock.events.push("parents");return mock.fetch(ids);}})};}
}}));
beforeEach(()=>{vi.resetModules();vi.stubEnv("PINECONE_API_KEY","offline-fake");mock.search.mockReset();mock.fetch.mockReset();mock.rerank.mockReset();mock.events.length=0;
  mock.search.mockImplementation(async(ns:string)=>({result:{hits:ns==="children"?Array.from({length:40},(_,i)=>({_id:"c"+i,_score:0.9-i/100,fields:{text:"Child concept "+i,parent_id:"p"+i,source_name:"S"+i,source_url:"https://example.org/"+i,source_description:"Offline fixture",chunk_type:"text"}})):[]}}));
  mock.rerank.mockResolvedValue({data:Array.from({length:6},(_,index)=>({index,score:0.9}))});
  mock.fetch.mockImplementation(async(ids:string[])=>({records:Object.fromEntries(ids.map(id=>[id,{metadata:{text:"Parent sentence. ".repeat(500)}}]))}));
});
afterEach(()=>vi.unstubAllEnvs());
describe("mocked Pinecone retrieval",()=>{
  it("reranks before bounded parent expansion and caches an identical lookup",async()=>{const {searchPinecone}=await import("../pinecone");const result=await searchPinecone("SIP");expect(mock.events).toEqual(["rerank","parents"]);expect(mock.fetch.mock.calls[0][0]).toHaveLength(6);expect(result.sources).toHaveLength(6);for(const s of result.sources)for(const c of s.chunks)expect(c.text.length).toBeLessThanOrEqual(2401);await searchPinecone("SIP");expect(mock.rerank).toHaveBeenCalledTimes(1);expect(mock.search).toHaveBeenCalledTimes(2);});
  it("optional proposition failure preserves child results",async()=>{const normal=mock.search.getMockImplementation()!;mock.search.mockImplementation((ns:string,arg:unknown)=>ns==="propositions"?Promise.reject(Error("offline proposition")):normal(ns,arg));const {searchPinecone}=await import("../pinecone");expect((await searchPinecone("risk")).sources).toHaveLength(6);});
  it("reranker failure uses bounded raw order",async()=>{mock.rerank.mockRejectedValue(Error("offline reranker"));const {searchPinecone}=await import("../pinecone");expect((await searchPinecone("gold")).sources).toHaveLength(6);expect(mock.fetch.mock.calls[0][0]).toHaveLength(6);});
  it("parent fetch failure retains child evidence",async()=>{mock.fetch.mockRejectedValue(Error("offline parent"));const {searchPinecone}=await import("../pinecone");expect((await searchPinecone("fees")).sources[0].chunks[0].text).toContain("Child concept");});
  it("a failed child lookup does not poison the cache",async()=>{const normal=mock.search.getMockImplementation()!;mock.search.mockRejectedValueOnce(Error("offline children"));const {searchPinecone}=await import("../pinecone");expect((await searchPinecone("bonds")).sources).toHaveLength(0);mock.search.mockImplementation(normal);expect((await searchPinecone("bonds")).sources).toHaveLength(6);});
  it("drops low-confidence children before expansion",async()=>{mock.search.mockResolvedValue({result:{hits:[{_id:"low",_score:0.01,fields:{text:"Unrelated",parent_id:"p",chunk_type:"text"}}]}});const {searchPinecone}=await import("../pinecone");expect((await searchPinecone("liquidity")).sources).toHaveLength(0);expect(mock.fetch).not.toHaveBeenCalled();});
});
