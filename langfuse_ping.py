from langfuse import Langfuse
lf = Langfuse(
    secret_key="sk-lf-23961941-fe40-441d-8dfe-196db37d05e6",
    public_key="pk-lf-ddb07d0c-c062-47a3-8074-b2bf3b0d491f",
    host="https://us.cloud.langfuse.com"
)

trace = lf.trace(name="smoke-test")       

root = trace.span(name="root-step")        
root.end(output="✅ finished")             

lf.flush()                                
print("Trace sent!")


