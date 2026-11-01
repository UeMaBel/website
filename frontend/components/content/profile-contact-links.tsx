import type { ProfileLink } from "../../lib/api";

export function ProfileContactLinks({ email, links }: { email: string; links: ProfileLink[] }) {
  return (
    <div className="profile-contact-links">
      {email.trim() ? (
        <p>Email: <a href={`mailto:${email}`}>{email}</a></p>
      ) : (
        <p role="status">Email contact is not available yet.</p>
      )}

      {links.length > 0 ? (
        <ul aria-label="Professional links">
          {links.map((link) => (
            <li key={`${link.position}-${link.url}`}>
              <a href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status">Professional links are not available yet.</p>
      )}
    </div>
  );
}
