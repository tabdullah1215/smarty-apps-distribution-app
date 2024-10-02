import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import OwnerDashboard from './components/OwnerDashboard';
import DistributorDashboard from './components/DistributorDashboard';
import DistributorRegistration from './components/DistributorRegistration';

function App() {
  return (
      <Router>
        <Switch>
          <Route path="/" exact component={OwnerDashboard} />
          <Route path="/distributor" exact component={DistributorDashboard} />
          <Route path="/register/:token" component={DistributorRegistration} />
        </Switch>
      </Router>
  );
}

export default App;