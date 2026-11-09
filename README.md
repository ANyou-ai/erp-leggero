# ERP leggero

Gemello dell'ERP della pizzeria: stessi conti (giacenza, sfrido, lista della spesa, food cost, fornitore più conveniente), pagina web senza server. Si pubblica su GitHub Pages.

I dati restano nel browser che la apre. Non finiscono su GitHub, a meno che non ci carichi tu il file di backup: non farlo, il repository è pubblico.

## Conti dell'esempio

Margherita con 0,145 kg di pelati. Due conteggi a 40 e 10 giorni fa (10 kg → 6 kg) e un carico di 30 kg in mezzo: consumo reale 34 kg, ricetta 29 kg, sfrido 34/29 ≈ 1,17. Dopo il conteggio sono uscite altre 40 pizze: in casa restano 0,2 kg. La spesa, su 7 giorni, propone 1 collo da 15 kg da Biancalani a 1,10 €/kg, cioè 16,50 €. Il Metro è a 1,20 e non vince, anche se il suo prezzo è salito da 0,90.

## Sul telefono

https://anyou-ai.github.io/erp-leggero/

Il primo avvio propone l’esempio dei pelati. I conteggi che fai restano in quel telefono.

## Aprire in locale

```bash
cd erp-leggero
python3 -m http.server 8765
```

Poi `http://127.0.0.1:8765/`. Il primo avvio propone l'esempio dei pelati.

## Pubblicare su GitHub Pages

1. Crea un repository **nuovo** che contiene solo i file di questa cartella. Non pubblicare tutto l'ERP: lì ci sono il database e dei token.
2. Sul repository: Settings → Pages → branch `main`, cartella `/ (root)`.
3. L'indirizzo è `https://TUO-UTENTE.github.io/NOME-REPOSITORY/`.

Due telefoni non si vedono da soli. Da Dati si scarica il backup JSON e si ricarica sull'altro.

## Cosa non fa

Non legge i PDF delle fatture e non scarica le vendite dal Drive. Carichi e vendite si scrivono a mano, oppure si incollano con il punto e virgola (Movimenti).

## Test

```bash
node --test erp-leggero/test/motore.test.js
```
