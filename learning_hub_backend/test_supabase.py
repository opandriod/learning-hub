from routes.supabase_client import supabase

res = supabase.storage.list_buckets()
print(res)