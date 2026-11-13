# Mock: the `Passos` list with the new order

Approved by the owner in the grill on 2026-11-12 ("Inverter nesta mudança"). Only the order of
`Provas` and `Revisão` changes; every other row, fact and label stays as devkit-panel 0.2.0 draws
it. The data is this change's own state while its next step is `verify`.

```
Passos (evidence-before-review, agora: verificar)

✓ Requisitos        5 critérios
✓ Plano             4 seções
✓ Prontidão         aprovada
✓ Sua aprovação    12/11
✓ Implementação     14/14 tarefas
● Provas            0/5 provados · verificar
○ Revisão
○ PR e checks
○ Merge
○ Retro e arquivo
```

Before this change (devkit-panel 0.2.0, same state), `Revisão` read as done although no review ran:

```
✓ Implementação     14/14 tarefas
✓ Revisão
● Provas            0/5 provados · verificar
○ PR e checks
```
