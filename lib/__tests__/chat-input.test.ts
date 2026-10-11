import { describe, it, expect } from "vitest";
import { parseChatInput } from "../ai/chat-input";
import { MAX_MESSAGES, MAX_MESSAGE_TEXT_LENGTH } from "@/config";
const message={id:"u",role:"user",parts:[{type:"text",text:"What is a SIP?"}]};
describe("chat request boundary",()=>{
 it.each([null,[],"text",{}, {messages:null},{messages:[]},{messages:[null]}, {messages:[{...message,role:"system"}]},{messages:[{...message,parts:[{type:"text",text:42}]}]}, {messages:[{...message,parts:[{type:"file",url:123,mediaType:"image/png"}]}]}])("rejects malformed or privileged-role input %j",body=>expect(parseChatInput(body)).toBeNull());
 it("preserves valid tool continuations and metadata",()=>{const body={messages:[message,{id:"a",role:"assistant",parts:[{type:"tool-presentRiskQuiz",toolCallId:"q",state:"output-available",input:{},output:{q1:"A",q2:"B",q3:"C",q4:"D",q5:"A"}}]}]};expect(parseChatInput(body)).toEqual(body.messages);});
 it("checks oversized history text as well as the latest question",()=>expect(parseChatInput({messages:[{...message,parts:[{type:"text",text:"x".repeat(MAX_MESSAGE_TEXT_LENGTH+1)}]},message]})).toBeNull());
 it("rejects too many messages",()=>expect(parseChatInput({messages:Array.from({length:MAX_MESSAGES+1},()=>message)})).toBeNull());
});
