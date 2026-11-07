import profile from "../../page-content/profile.json";
import { ContentSection } from "../../components/content/content-section";
import { Markdown } from "../../components/content/markdown";
import { PageHeading } from "../../components/content/page-heading";
import { getProfile } from "../../lib/api";
import type { PublicProfile } from "../../lib/api";
import { publicPageMetadata } from "../../lib/metadata";

export const metadata = publicPageMetadata(
  "About / CV",
  "Learn about my software engineering experience, education, skills, and professional background.",
  "/about",
);

function sortByPosition<T extends { position: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.position - right.position);
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function DateRange({ start, end }: { start: string | null; end: string | null }) {
  if (!start && !end) {
    return null;
  }

  return (
    <p className="profile-entry-dates">
      {start && <time dateTime={start}>{formatDate(start)}</time>}
      {start && end && " to "}
      {end ? <time dateTime={end}>{formatDate(end)}</time> : start ? " to Present" : null}
    </p>
  );
}

export default async function AboutPage() {
  const profileResult = await Promise.allSettled([getProfile()]);
  const currentProfile: PublicProfile = profileResult[0].status === "fulfilled"
    ? profileResult[0].value
    : profile;
  const experience = sortByPosition(currentProfile.experience);
  const education = sortByPosition(currentProfile.education);
  const skills = sortByPosition(currentProfile.skills);

  return (
    <>
      <PageHeading title="About / CV">
        {currentProfile.display_name.trim() && (
          <p className="profile-display-name">{currentProfile.display_name}</p>
        )}
      </PageHeading>

      <ContentSection id="biography" title="Biography">
        {currentProfile.biography.trim() ? (
          <Markdown source={currentProfile.biography} />
        ) : (
          <p className="profile-empty" role="status">Biography coming soon.</p>
        )}
      </ContentSection>

      <ContentSection id="experience" title="Experience">
        {experience.length > 0 ? (
          <ol className="profile-entry-list">
            {experience.map((entry) => (
              <li
                className="profile-entry"
                key={`${entry.position}-${entry.employer}-${entry.role}-${entry.start_date ?? ""}`}
              >
                <h3>{entry.role}</h3>
                <p className="profile-entry-organization">{entry.employer}</p>
                <DateRange start={entry.start_date} end={entry.end_date} />
                {entry.description.trim() && <Markdown source={entry.description} />}
              </li>
            ))}
          </ol>
        ) : (
          <p className="profile-empty" role="status">Experience details coming soon.</p>
        )}
      </ContentSection>

      <ContentSection id="education" title="Education">
        {education.length > 0 ? (
          <ol className="profile-entry-list">
            {education.map((entry) => (
              <li
                className="profile-entry"
                key={`${entry.position}-${entry.institution}-${entry.qualification}-${entry.start_date ?? ""}`}
              >
                <h3>{entry.qualification}</h3>
                <p className="profile-entry-organization">{entry.institution}</p>
                <DateRange start={entry.start_date} end={entry.end_date} />
                {entry.description.trim() && <Markdown source={entry.description} />}
              </li>
            ))}
          </ol>
        ) : (
          <p className="profile-empty" role="status">Education details coming soon.</p>
        )}
      </ContentSection>

      <ContentSection id="skills" title="Skills">
        {skills.length > 0 ? (
          <ul className="profile-skill-list">
            {skills.map((skill) => (
              <li key={`${skill.position}-${skill.name}-${skill.category}`}>
                <span>{skill.name}</span>
                {skill.category && <span className="profile-skill-category">{skill.category}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="profile-empty" role="status">Skills coming soon.</p>
        )}
      </ContentSection>

      <ContentSection id="curriculum-vitae" title="Curriculum vitae">
        {currentProfile.cv_url ? (
          <p>
            <a href={currentProfile.cv_url} download>
              Download CV (PDF)
            </a>
          </p>
        ) : (
          <p className="profile-empty" role="status">A downloadable CV is not available yet.</p>
        )}
      </ContentSection>
    </>
  );
}
