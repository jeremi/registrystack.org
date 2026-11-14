// French wording of src/data/solutions.ts, for the pages under src/pages/fr/.
// Keys, slugs, starters and products are the English values; only the
// reader-facing text changes. tests/french-data checks that every English
// text field has a French counterpart. Slugs and FAQ links stay English here:
// components pass them through `localizedPath` from src/i18n.ts.
import {
  sharedFamilyFaq as englishFaq,
  solutionAreas as englishAreas,
  starterOrderForArea,
  type SolutionArea,
} from '../solutions.ts';

export { starterOrderForArea, type SolutionArea };

type AreaText = Pick<SolutionArea, 'key' | 'name' | 'pageTitle' | 'intent' | 'audience' | 'description' | 'example'>;

const areaText: readonly AreaText[] = [
  {
    key: 'licensing',
    name: 'Licences, autorisations et registres professionnels',
    pageTitle: 'Logiciel pour les licences, autorisations et registres professionnels',
    intent: 'Relier les demandes, les décisions, les fiches d’autorisation et les renouvellements',
    audience: 'Pour les autorités qui délivrent licences et autorisations, et pour les ordres professionnels.',
    description: 'Reliez demandes, décisions, fiches d’autorisation et renouvellements, et ouvrez aux employeurs et à d’autres services des vérifications encadrées.',
  },
  {
    key: 'business-and-tax',
    name: 'Entreprises, fiscalité et finance',
    pageTitle: 'Logiciel pour les registres des entreprises et des contribuables',
    intent: 'Enregistrer les entreprises et leurs modifications, et permettre aux services autorisés de vérifier leur statut',
    audience: 'Pour les registres du commerce, les administrations fiscales, les douanes et les autorités de supervision financière.',
    description: 'Enregistrez entreprises et contribuables, examinez les modifications et permettez aux services autorisés de vérifier leur inscription.',
  },
  {
    key: 'agriculture-food-and-environment',
    name: 'Agriculture, animaux, alimentation et environnement',
    pageTitle: 'Logiciel pour les registres agricoles, animaliers et environnementaux',
    intent: 'Inscrire les producteurs, sites, établissements, autorisations et ressources',
    audience: 'Pour les ministères de l’agriculture, les services vétérinaires et de sécurité sanitaire des aliments, et les agences de l’environnement.',
    description: 'Inscrivez producteurs, sites, entreprises alimentaires, permis, ressources naturelles. Consignez les changements ; un service autorisé peut vérifier le statut.',
  },
  {
    key: 'people-and-social-programmes',
    name: 'Personnes, ménages et programmes sociaux',
    pageTitle: 'Logiciel pour les registres de population et de programmes sociaux',
    intent: 'Tenir les fiches d’identité, de ménage, d’inscription et de statut pour les services publics',
    audience: 'Pour l’état civil et les registres de population, la protection sociale, l’éducation, l’immigration et les autorités électorales.',
    description: 'Tenez registres de population, registres sociaux et inscriptions, examinez les corrections et permettez aux services autorisés de vérifier un point précis.',
  },
  {
    key: 'land-property-and-assets',
    name: 'Foncier, immobilier, véhicules et lieux',
    pageTitle: 'Logiciel pour les registres fonciers, immobiliers et de véhicules',
    intent: 'Enregistrer les biens, leurs détenteurs et les droits associés, avec l’historique des modifications',
    audience: 'Pour les cadastres, les registres fonciers et les registres de véhicules et de navires.',
    description: 'Tenez les fiches des parcelles, bâtiments, véhicules et navires, de leurs détenteurs ou des droits associés, avec l’historique des modifications.',
  },
  {
    key: 'health-and-safety',
    name: 'Santé, sécurité et produits réglementés',
    pageTitle: 'Logiciel pour les registres de santé et de sécurité',
    intent: 'Tenir les fiches des établissements, opérateurs, produits et risques',
    audience: 'Pour les registres d’établissements de santé, les autorités du médicament et des dispositifs médicaux, et la radioprotection.',
    description: 'Tenez les fiches des établissements, essais, dispositifs, opérateurs et risques. Consignez les décisions ; un service autorisé peut en vérifier le statut.',
  },
  {
    key: 'reference-registers',
    name: 'Organismes publics, listes de référence et catalogues',
    pageTitle: 'Logiciel pour les registres de référence et les annuaires publics',
    intent: 'Tenir les nomenclatures, annuaires et données de référence partagés',
    audience: 'Pour les instituts de statistique, les autorités de cartographie et de toponymie, et tout service qui tient une liste de codes.',
    description: 'Tenez les listes de codes, les noms de lieux et les annuaires d’organismes publics sur lesquels s’appuient les autres registres et services.',
  },
  {
    key: 'check-a-fact',
    name: 'Vérifier une information auprès d’un autre registre',
    pageTitle: 'Vérifier une information entre administrations',
    intent: 'Obtenir la réponse à une question précise sans recevoir toute la fiche',
    example: 'Par exemple, un système de marchés publics peut vérifier qu’un fournisseur est inscrit. L’institution qui tient le registre décide des vérifications autorisées.',
    description: 'Permettez à un service autorisé de vérifier une information, comme un seuil d’âge ou le statut d’une autorisation, sans recevoir toute la fiche.',
  },
  {
    key: 'review-changes',
    name: 'Examiner les demandes et consigner les décisions',
    pageTitle: 'Examen des modifications de registre et décisions des agents',
    intent: 'Attribuer les demandes aux agents, suivre les échéances et consigner le résultat',
    example: 'Par exemple, les agents chargés des autorisations peuvent examiner une demande de correction d’une fiche d’autorisation.',
    description: 'Attribuez les demandes, suivez les échéances et consignez les décisions. Seuls les agents ou systèmes autorisés peuvent appliquer la modification approuvée.',
  },
  {
    key: 'verifiable-credentials',
    name: 'Délivrer des attestations vérifiables',
    pageTitle: 'Attestations vérifiables à partir des registres publics',
    intent: 'Délivrer une déclaration signée numériquement, comme le statut d’une autorisation, dans un portefeuille numérique compatible',
    example: 'Par exemple, un ordre professionnel peut délivrer une attestation du statut d’une autorisation d’exercice sans y inclure son historique.',
    description: 'Délivrez des attestations vérifiables à partir du registre. Connectez un portefeuille compatible et le service destinataire lors de votre mise en œuvre.',
  },
];

export const solutionAreas: readonly SolutionArea[] = englishAreas.map((area) => {
  const text = areaText.find((candidate) => candidate.key === area.key);
  if (!text) throw new Error(`src/data/fr/solutions.ts has no French wording for ${area.key}`);
  return { ...area, ...text };
});

export const sharedFamilyFaq: readonly { q: string; a: string; link?: { href: string; label: string } }[] = [
  {
    q: 'Comment préparer une mise en œuvre ?',
    a: 'Commencez par un seul service et arrêtez d’un commun accord ce qu’il requiert : fiches, tâches des agents, écrans, connexions et reprise des données. Un périmètre convenu par écrit précise qui réalise, héberge et exploite le service, y compris les accès, les sauvegardes et la prise en main par votre équipe.',
    link: { href: englishFaq[0].link!.href, label: 'Questions sur la propriété, la réalisation et l’exploitation' },
  },
  {
    q: 'Comment l’équipe technique peut-elle évaluer le logiciel ?',
    a: 'Elle peut suivre les tutoriels des composants pour tester leur fonctionnement de base avec des données d’exemple. Un service complet nécessite encore ses propres règles, ses applications connectées et des tests de bout en bout.',
    link: { href: englishFaq[1].link!.href, label: 'Évaluation technique' },
  },
];

export const registerFamilies = solutionAreas.filter((area) => area.kind === 'register-family');

export const solutionAreaForStarter = (starterId: string): SolutionArea | undefined =>
  solutionAreas.find((area) => area.starters.includes(starterId));
