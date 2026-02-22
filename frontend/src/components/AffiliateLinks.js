import React from 'react';

const links = [
  {
    title: 'TopResume',
    description: 'Professional resume writing services',
    url: 'https://www.topresume.com',
    category: 'Resume Services'
  },
  {
    title: 'LinkedIn Premium',
    description: 'Stand out and get in touch with recruiters',
    url: 'https://premium.linkedin.com',
    category: 'Networking'
  },
  {
    title: 'Coursera',
    description: 'Boost your skills with online courses',
    url: 'https://www.coursera.org',
    category: 'Learning'
  },
  {
    title: 'Indeed',
    description: 'Search millions of job listings',
    url: 'https://www.indeed.com',
    category: 'Job Boards'
  }
];

const AffiliateLinks = ({ layout = 'horizontal' }) => {
  const isVertical = layout === 'vertical';

  return (
    <div className={`${isVertical ? 'space-y-3' : 'grid grid-cols-2 md:grid-cols-4 gap-3'}`}>
      <div className={`text-xs text-slate-500 mb-1 ${isVertical ? '' : 'col-span-full'}`}>
        Career Resources
      </div>
      {links.map((link) => (
        <a
          key={link.title}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="text-xs text-blue-600 font-medium mb-0.5">{link.category}</div>
          <div className="text-sm font-medium text-slate-900">{link.title}</div>
          <div className="text-xs text-slate-500">{link.description}</div>
        </a>
      ))}
    </div>
  );
};

export default AffiliateLinks;
