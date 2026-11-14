// French wording of src/data/products.ts, for the pages under src/pages/fr/.
// Keys, product names, links and flags are the English values, so the two
// files must list the same products in the same order; tests/french-data
// checks that. Links stay English here: components pass them through
// `localizedPath` from src/i18n.ts. `description` stays under 155 characters.
import { companionServices as englishCompanionServices, products as englishProducts } from '../products.ts';

type Product = (typeof englishProducts)[number];
type ProductText = Pick<Product, 'key'> & {
  solution: string;
  intent: string;
  description: string;
  tutorialLabel: string;
  firstResult: string;
};

const productText: readonly ProductText[] = [
  {
    key: 'base-registry',
    solution: 'Tenue du registre',
    intent: 'Tenir les fiches et leur historique',
    description: 'Tenez votre registre, contrôlez les accès et conservez l’historique des modifications. Un logiciel open source relié à vos services publics.',
    tutorialLabel: 'Suivre le tutoriel du registre (en anglais)',
    firstResult: 'Créer un registre de contacts en local, ajouter et lire une fiche, puis vérifier qu’un service relevant d’une autre juridiction ne peut pas la lister.',
  },
  {
    key: 'evidence-gateway',
    solution: 'Vérification d’informations',
    intent: 'Permettre à des services autorisés de vérifier une information du registre',
    description: 'Permettez à des services autorisés de vérifier une information de votre registre. Seule la réponse convenue est renvoyée, signée par l’émetteur.',
    tutorialLabel: 'Suivre le tutoriel de vérification (en anglais)',
    firstResult: 'Examiner le projet prédéfini de vérification de la majorité, demander sa réponse signée à une source de données fictives, puis vérifier la réponse JWS.',
  },
  {
    key: 'casework',
    solution: 'Instruction des demandes',
    intent: 'Attribuer les examens et consigner les décisions des agents',
    description: 'Attribuez les demandes aux agents, suivez les échéances et consignez leurs décisions. Un logiciel d’examen open source relié à vos services publics.',
    tutorialLabel: 'Lire le tutoriel sur l’examen des modifications (en anglais)',
    firstResult: 'Préparer et valider la configuration d’une modification de registre qui doit être examinée par un agent.',
  },
  {
    key: 'render',
    solution: 'Documents d’autorisation',
    intent: 'Produire et signer numériquement des documents PDF',
    description: 'Autorisations et certificats PDF issus des données fournies et de modèles approuvés. Cachet électronique de l’institution, horodatage en option.',
    tutorialLabel: 'Suivre le tutoriel des documents (en anglais)',
    firstResult: 'Produire un exemple de lettre en local, puis demander le document par HTTP.',
  },
  {
    key: 'messaging',
    solution: 'Notifications du service',
    intent: 'Envoyer des notifications approuvées par courriel et SMS',
    description: 'Envoyez des notifications approuvées par courriel ou SMS via votre fournisseur. Chaque demande est enregistrée et son statut d’envoi suivi.',
    tutorialLabel: 'Suivre le tutoriel des notifications (en anglais)',
    firstResult: 'Envoyer une notification à partir d’un modèle via un fournisseur fictif local, puis consulter son statut.',
  },
];

const textFor = <T extends { key: string }>(entries: readonly T[], key: string, file: string): T => {
  const entry = entries.find((candidate) => candidate.key === key);
  if (!entry) throw new Error(`${file} has no French wording for ${key}`);
  return entry;
};

export const products = englishProducts.map((product) => ({
  ...product,
  ...textFor(productText, product.key, 'src/data/fr/products.ts'),
}));

const companionText: readonly { key: string; job: string }[] = [
  { key: 'scheduling', job: 'définit les capacités, les réservations provisoires et les règles de prise de rendez-vous' },
  { key: 'manifest', job: 'publie le contenu du registre sous forme de catalogue lisible par d’autres services' },
];

export const companionServices = englishCompanionServices.map((service) => ({
  ...service,
  ...textFor(companionText, service.key, 'src/data/fr/products.ts'),
}));
