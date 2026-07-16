import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, Pencil, Plus, LogOut, MapPin, MessageSquare, BookOpen, X, Check } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

type KbEntry = { id: string; title: string; content: string; updated_at: string };
type TgMessage = { update_id: number; chat_id: number; username: string | null; text: string | null; reply: string | null; created_at: string };

function Dashboard() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [entries, setEntries] = useState<KbEntry[]>([]);
  const [messages, setMessages] = useState<TgMessage[]>([]);
  const [editing, setEditing] = useState<KbEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate({ to: "/auth" });
        return;
      }
      setEmail(sessionData.session.user.email ?? null);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", sessionData.session.user.id);
      const admin = (roles ?? []).some((r) => r.role === "admin");
      setIsAdmin(admin);
      setReady(true);
      if (admin) {
        await Promise.all([loadEntries(), loadMessages()]);
      }
    })();
  }, [navigate]);

  const loadEntries = async () => {
    const { data } = await supabase.from("kb_entries").select("*").order("updated_at", { ascending: false });
    setEntries((data ?? []) as KbEntry[]);
  };
  const loadMessages = async () => {
    const { data } = await supabase.from("telegram_messages").select("update_id, chat_id, username, text, reply, created_at").order("created_at", { ascending: false }).limit(100);
    setMessages((data ?? []) as TgMessage[]);
  };

  const openNew = () => { setEditing(null); setTitle(""); setContent(""); setShowForm(true); };
  const openEdit = (e: KbEntry) => { setEditing(e); setTitle(e.title); setContent(e.content); setShowForm(true); };
  const cancel = () => { setShowForm(false); setEditing(null); setTitle(""); setContent(""); };

  const save = async () => {
    if (!title.trim() || !content.trim()) { toast.error("Title and content required"); return; }
    if (editing) {
      const { error } = await supabase.from("kb_entries").update({ title, content }).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Updated");
    } else {
      const { error } = await supabase.from("kb_entries").insert({ title, content });
      if (error) return toast.error(error.message);
      toast.success("Added");
    }
    cancel();
    loadEntries();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    const { error } = await supabase.from("kb_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    loadEntries();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No admin access</CardTitle>
            <CardDescription>Your account ({email}) does not have admin privileges.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={signOut} variant="outline"><LogOut className="mr-2 h-4 w-4" /> Sign out</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">GIS Consultancy Admin</h1>
              <p className="text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sign out</Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Tabs defaultValue="kb">
          <TabsList>
            <TabsTrigger value="kb"><BookOpen className="mr-2 h-4 w-4" /> Knowledge base</TabsTrigger>
            <TabsTrigger value="messages"><MessageSquare className="mr-2 h-4 w-4" /> Conversations</TabsTrigger>
          </TabsList>

          <TabsContent value="kb" className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Knowledge base</h2>
                <p className="text-sm text-muted-foreground">Content the bot uses to answer questions.</p>
              </div>
              {!showForm && <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New entry</Button>}
            </div>

            {showForm && (
              <Card>
                <CardHeader>
                  <CardTitle>{editing ? "Edit entry" : "New entry"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="t">Title</Label>
                    <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Services we offer" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c">Content</Label>
                    <Textarea id="c" value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder="Full answer, facts, terminology…" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={save}><Check className="mr-2 h-4 w-4" /> Save</Button>
                    <Button variant="outline" onClick={cancel}><X className="mr-2 h-4 w-4" /> Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {entries.length === 0 && !showForm && (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No entries yet. Add your first one.</CardContent></Card>
            )}

            <div className="grid gap-3">
              {entries.map((e) => (
                <Card key={e.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                    <div className="flex-1">
                      <CardTitle className="text-base">{e.title}</CardTitle>
                      <CardDescription className="mt-2 whitespace-pre-wrap text-sm">{e.content}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="messages" className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Recent conversations</h2>
                <p className="text-sm text-muted-foreground">Last 100 Telegram exchanges.</p>
              </div>
              <Button variant="outline" size="sm" onClick={loadMessages}>Refresh</Button>
            </div>
            {messages.length === 0 && (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No messages yet. Connect the webhook and message your bot.</CardContent></Card>
            )}
            <div className="space-y-3">
              {messages.map((m) => (
                <Card key={m.update_id}>
                  <CardContent className="space-y-2 pt-6">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>@{m.username ?? "unknown"} · chat {m.chat_id}</span>
                      <span>{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    <div className="rounded-md bg-muted p-3 text-sm"><span className="font-medium">User:</span> {m.text ?? "(no text)"}</div>
                    {m.reply && <div className="rounded-md bg-primary/5 p-3 text-sm"><span className="font-medium">Bot:</span> {m.reply}</div>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
