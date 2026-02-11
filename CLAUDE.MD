
## Workflow Preference
- **Planning**: Always plan first using Opus 4.6 (main agent)
- **Bei Unklarheiten**: Nachfragen bevor Plan finalisiert wird
- **Plan vorstellen**: Immer dem User zeigen und Freigabe abwarten
- **Execution**: Erst nach Freigabe an Sonnet 4.5 Task agents delegieren (model="sonnet")


## Auto-Commit Script
- `scripts/commit-and-push.sh "message"` - type-checks, stages, commits, pushes
- **IMMER** nach jeder Aenderung automatisch committen und pushen (Bash-Agent delegieren)
- Nicht erst den User fragen, sondern direkt ausfuehren


## Phaser UI Pitfall
- **NIEMALS** Container mit `setScrollFactor(0)` fuer UI verwenden! Hitboxen driften bei Kamerabewegung.
- **IMMER** `setScrollFactor(0).setDepth(X)` auf jedes einzelne Element setzen (Text, Graphics, Rectangle).
- Alle Elemente in einem `elements[]` Array sammeln fuer Cleanup in `destroy()`.
- Siehe `src/ui/ShotPanel.ts` als Referenz-Pattern.
