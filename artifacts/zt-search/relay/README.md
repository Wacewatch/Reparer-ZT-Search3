# Relais ZT Search (contourner le blocage Cloudflare du .org)

## ⭐ Le plus simple : zt_org.php (fichier unique, site complet)
Recherche + fiches + liens téléchargement/streaming par qualité, tout dans un seul PHP.
1. Installe PHP (Windows : https://windows.php.net/download — prends la version "Thread Safe" zip, active `extension=curl` dans php.ini ; Linux : `apt install php-cli php-curl`).
2. Dans le dossier : `php -S 0.0.0.0:8787 zt_org.php` puis ouvre http://localhost:8787
3. API JSON : `?q=avatar&cat=films&format=json` et `?id=film/2903-avatar&format=json`
4. Accès depuis ton téléphone / Internet (gratuit) : `cloudflared tunnel --url http://localhost:8787`
5. Il fait aussi relais pour l'app ZT Search : change `RELAY_KEY` et ajoute l'URL du tunnel dans **Sources**.

Le .org bloque les IP de datacenters et les Workers Cloudflare. Le relais doit tourner sur une IP **résidentielle** (ton PC / ta box) ou un hébergement non bloqué.

## Option A — PC perso + tunnel gratuit (100 % gratuit, le plus fiable)
1. Édite `RELAY_KEY` dans `relay.py` (ou `relay.php`).
2. Lance le relais :
   - Python : `python relay.py` (port 8787)
   - PHP : `php -S 0.0.0.0:8787 relay.php`
3. Teste en local : `http://localhost:8787/?url=https%3A%2F%2Fwww.zone-telechargement.org%2F&key=TA_CLE`
4. Expose-le sur Internet gratuitement avec Cloudflare Tunnel (pas de compte requis) :
   `cloudflared tunnel --url http://localhost:8787`
   → copie l'URL `https://xxxx.trycloudflare.com` affichée.
   (Le tunnel n'est PAS un Worker : la requête vers le .org part bien de TON IP résidentielle.)
5. Dans ZT Search → bouton **Sources** → ajoute l'URL du tunnel + ta clé → **Tester**.

## Option B — Hébergement PHP mutualisé
Upload `relay.php` (ex. `https://mon-site.fr/relay.php`), change la clé, ajoute l'URL dans **Sources**.
Fonctionne seulement si l'IP de l'hébergeur n'est pas bannie (tester avec le bouton **Tester**).

## Option C — ScraperAPI (gratuit 1000 requêtes/mois)
Crée un compte sur https://www.scraperapi.com, copie la clé API dans **Sources**.

L'app essaie dans l'ordre : relais → ScraperAPI → direct. Les pages sont mises en cache 10 min.
