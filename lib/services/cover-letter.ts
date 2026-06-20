type CoverLetterInput = {
  clientName: string;
  currentJobTitle: string;
  mainSkills: string[];
  secondarySkills: string[];
  workAuthorizationNotes?: string | null;
  applicationNotes?: string | null;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  requiredSkills: string[];
  coveredKeywords: string[];
  missingKeywords: string[];
};

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function pickSignals(input: CoverLetterInput) {
  const jobText = `${input.jobTitle} ${input.jobDescription}`.toLowerCase();
  const skills = unique([
    ...input.coveredKeywords,
    ...input.requiredSkills,
    ...input.mainSkills,
    ...input.secondarySkills
  ]).filter((skill) => jobText.includes(skill.toLowerCase()) || input.mainSkills.includes(skill));

  return skills.slice(0, 6);
}

export function generateCoverLetter(input: CoverLetterInput) {
  const skills = pickSignals(input);
  const skillSentence = skills.length
    ? `My background aligns strongly with the role's needs across ${skills.slice(0, 5).join(", ")}.`
    : `My background aligns with the responsibilities and business context described in the posting.`;

  const missingKeywords = input.missingKeywords.slice(0, 4);
  const tailoringSentence = missingKeywords.length
    ? `I am also comfortable ramping quickly into related requirements such as ${missingKeywords.join(", ")} where the team needs additional emphasis.`
    : `I would bring a practical, delivery-focused approach from day one.`;

  const authorizationSentence = input.workAuthorizationNotes
    ? ` ${input.workAuthorizationNotes}`
    : "";

  const noteSentence = input.applicationNotes
    ? `\n\nApplication note for reviewer: ${input.applicationNotes}`
    : "";

  return [
    `Dear Hiring Team,`,
    ``,
    `I am excited to apply for the ${input.jobTitle} role at ${input.companyName}. As a ${input.currentJobTitle}, I have built experience that maps well to the work described in this opportunity. ${skillSentence}`,
    ``,
    `In my recent work, I have focused on solving practical business problems, collaborating with stakeholders, and delivering reliable outcomes. ${tailoringSentence} I would welcome the chance to bring that same discipline and ownership to ${input.companyName}.`,
    ``,
    `Thank you for considering my application. I would be glad to discuss how my experience can support your team.${authorizationSentence}`,
    ``,
    `Sincerely,`,
    input.clientName,
    noteSentence
  ].filter((line) => line !== undefined).join("\n");
}
